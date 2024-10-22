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

type Decay = 'exponential' | 'linear';

export interface InfluenceMapProps {
  /**
   * 0.1 = faster changes, 0.9 = slower changes
   */
  momentum: number;
  /**
   * Function used for the decay
   */
  decayFunction: Decay;
  /**
   * Control how much the decay is impactful with the distance
   */
  decay: number;
  /**
   * Number of frames between updates
   */
  updateCooldown: number;
}
export const INFLUENCE_MAP_PROPS_DEFAULT: InfluenceMapProps = {
  momentum: 0.8,
  decayFunction: 'exponential',
  decay: 0.4,
  updateCooldown: 1,
};

export class InfluenceMap {
  private dataTiles: Map<number, number> = new Map();
  private bufferDataTiles: Map<number, number> = new Map();
  private cooldown: number = 0;

  /**
   * @param getBaseInfluence Callback to obtain the influence of a tile
   * @param props Influence map parameters
   */
  constructor(
    private getBaseInfluence: (positionHash: number, frame: Frame) => number,
    private props: InfluenceMapProps = INFLUENCE_MAP_PROPS_DEFAULT
  ) {}

  init(tilesPositionHash: number[]) {
    for (let positionHash of tilesPositionHash) {
      this.dataTiles.set(positionHash, 0);
      this.bufferDataTiles.set(positionHash, 0);
    }
  }

  private applyDecay(value: number): number {
    switch (this.props.decayFunction) {
      case 'exponential':
        return value * Math.exp(-this.props.decay);
      case 'linear':
        return value * this.props.decay;
    }
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
    for (let [p, prevValue] of this.bufferDataTiles) {
      const valueNeighbours = this.getNeighbours(p)
        .map((n) => this.bufferDataTiles.get(n))
        .filter((v) => v !== undefined)
        .map((v) => this.applyDecay(v));
      const maxInf = valueNeighbours.reduce((p, c) => Math.max(p, c), 0);
      const minInf = valueNeighbours.reduce((p, c) => Math.min(p, c), 0);

      const mostDominant = -minInf > maxInf ? minInf : maxInf;
      const newValue = linearInterpolation(
        prevValue,
        mostDominant,
        this.props.momentum
      );
      this.dataTiles.set(p, newValue);
    }
  }

  getInfluence(positionHash: number): number {
    return this.dataTiles.get(positionHash);
  }

  private getNeighbours(positionHash: number) {
    const facteurHashX = 10e5;
    const facteurHashY = 1;
    const position: Position = hashToMapPosition(positionHash);
    return [
      0 < position.x ? positionHash - facteurHashX : undefined,
      0 < position.y ? positionHash - facteurHashY : undefined,
      position.x < 15 ? positionHash + facteurHashX : undefined,
      position.x < 15 ? positionHash + facteurHashY : undefined,
    ];
  }
}
