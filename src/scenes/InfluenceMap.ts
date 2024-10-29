import { Position } from '@lux-ai/2021-challenge';
import { Frame } from './MainScene';
import { hashToMapPosition } from './utils';

function linearInterpolation(
  currentValue: number,
  targetValue: number,
  momentum: number
): number {
  return currentValue * momentum + targetValue * (1 - momentum);
}

export interface InfluenceMapProps {
  /**
   * Control how much we want historical data (range `]0;1]`)
   * - Value closer to `0` = faster changes, don't use historical data
   * - Value closer to `1` = slower changes, keep historical data
   */
  momentum: number;
  /**
   * Number of frames between updates
   */
  updateCooldown: number;
  /**
   * Base convolution matrix, e.g. a Gaussian matrix
   */
  convolutionMatrix: number[];
}
export function createInfluenceMapPropsDefault(): InfluenceMapProps {
  return {
    momentum: 0.999,
    updateCooldown: 1,
    convolutionMatrix: createGaussianLikeMatrix({
      spread: 0.2,
      naturalDecay: 0.001,
    }),
  };
}
export function createGaussianMatrix(): number[] {
  return [1, 2, 1, 2, 4, 2, 1, 2, 1];
}
export function createGaussianLikeMatrix(params: {
  /**
   * Control how much the influence spread (range `]0;1]`)
   * - Value closer to `1`: propagates more
   * - Value closer to `0`: propagates less
   */
  spread: number;
  /**
   * Control how much to reduce all influence over time (range `[0;1]`)
   * - Value closer to `0` will eventually fill the entire map, influence never decreases,
   * expected with sources of negative influence
   * - Value closer to `1` decreases drastically the influence over time
   */
  naturalDecay: number;
  /**
   * Base convolution matrix, e.g. a Gaussian matrix
   */
  baseMatrix?: number[];
}): number[] {
  const m = params.baseMatrix ?? createGaussianMatrix();

  // add decay
  m.forEach((_, i) => i !== 4 && (m[i] *= params.spread));

  // normalize
  const sum = m.reduce((p, c) => p + c, 0);
  m.forEach((v, i) => (m[i] /= sum));

  // add natural decay
  m.forEach((v, i) => (m[i] *= 1 - params.naturalDecay));

  return m;
}

export class InfluenceMap {
  private dataTiles: Map<number, number> = new Map();
  private bufferDataTiles: Map<number, number> = new Map();
  private cooldown: number = 0;
  public mapWidth: number = 16;
  public mapHeight: number = 16;
  get matrix() {
    return this.props.convolutionMatrix;
  }

  /**
   * @param getBaseInfluence Callback to obtain the influence of a tile
   * @param props Influence map parameters
   */
  constructor(
    private getBaseInfluence: (positionHash: number, frame: Frame) => number,
    private props: InfluenceMapProps = createInfluenceMapPropsDefault()
  ) {}

  init(tilesPositionHash: number[], mapWidth: number, mapHeight: number) {
    for (let positionHash of tilesPositionHash) {
      this.dataTiles.set(positionHash, 0);
      this.bufferDataTiles.set(positionHash, 0);
    }
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
  }

  update(frame: Frame) {
    this.cooldown--;
    if (this.cooldown > 0) return;
    this.cooldown = this.props.updateCooldown;

    // Fill the buffer and set the base influence
    for (let [p, prevValue] of this.dataTiles) {
      const baseValue = this.getBaseInfluence(p, frame);

      if (Math.abs(prevValue) < Math.abs(baseValue)) {
        this.bufferDataTiles.set(p, baseValue);
      } else {
        this.bufferDataTiles.set(p, prevValue);
      }
    }

    // Propagate and store in the final map
    for (let [p, prevValue] of this.dataTiles) {
      let newValue = this.getNeighbours(p)
        .map((n) => this.bufferDataTiles.get(n))
        .map((v, i) => (v !== undefined ? v * this.matrix[i] : undefined))
        .filter((v) => v !== undefined)
        .reduce((p, c) => p + c, 0);

      newValue = linearInterpolation(prevValue, newValue, this.props.momentum);

      this.dataTiles.set(p, newValue);
    }
  }

  getInfluence(positionHash: number): number {
    return this.dataTiles.get(positionHash);
  }

  private getNeighbours(positionHash: number) {
    const dX = 10e5;
    const dY = 1;
    const position: Position = hashToMapPosition(positionHash);
    const westValid = 0 < position.x;
    const northValid = 0 < position.y;
    const eastValid = position.x < this.mapWidth - 1;
    const southValid = position.y < this.mapHeight - 1;
    return [
      northValid && westValid ? positionHash - dY - dX : undefined,
      northValid ? positionHash - dY : undefined,
      northValid && eastValid ? positionHash - dY + dX : undefined,
      westValid ? positionHash - dX : undefined,
      positionHash,
      eastValid ? positionHash + dX : undefined,
      southValid && westValid ? positionHash + dY - dX : undefined,
      southValid ? positionHash + dY : undefined,
      southValid && eastValid ? positionHash + dY + dX : undefined,
    ];
  }
}
