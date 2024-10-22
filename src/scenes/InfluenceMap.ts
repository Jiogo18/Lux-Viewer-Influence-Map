import { Frame } from "./MainScene";

export class InfluenceMap {
  private dataTiles: Map<number, number> = new Map();
  private readonly max = 1;

  constructor(
    private getRelativeInfluence: (positionHash: number, frame: Frame) => number
  ) {}

  init(tilesPositionHash: number[]) {
    for (let positionHash of tilesPositionHash) {
      this.dataTiles.set(positionHash, 0);
    }
  }

  update(frame: Frame) {
    // TODO: this is a placeholder to be replaced by a real influence map algorithm
    for (let [positionHash, prevValue] of this.dataTiles) {
      this.dataTiles.set(positionHash,
        Math.min(this.max, Math.max(-this.max,
          prevValue + this.getRelativeInfluence(positionHash, frame)
        ))
      );
    }
  }

  getInfluence(positionHash: number): number {
    return this.dataTiles.get(positionHash);
  }
}