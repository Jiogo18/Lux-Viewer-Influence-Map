import 'phaser';
import React, { useEffect, useState } from 'react';
import classnames from 'classnames';
import MainScene, { Frame, FrameTileData } from '../scenes/MainScene';
import { createGame } from '../game';
import {
  Button,
  CircularProgress,
  ButtonGroup,
  Card,
  CardContent,
  Slider,
  IconButton,
} from '@material-ui/core';
import './styles.css';
import { LuxMatchConfigs } from '@lux-ai/2020-challenge/lib/es6';
import TileStats from './TileStats';
import { hashToMapPosition, mapCoordsToIsometricPixels } from '../scenes/utils';
import GlobalStats from './GlobalStats';
import ReplayButtonSVG from '../icons/loading.svg';
import PauseButtonSVG from '../icons/pause.svg';
import ArrowsSVG from '../icons/arrows.svg';
import DayTimeSVG from '../icons/daytime.svg';
import NightTimeSVG from '../icons/nighttime.svg';
import OptionsSVG from '../icons/options.svg';

export type GameComponentProps = {
  replayData: any;
};

export const GameComponent = ({ replayData }: GameComponentProps) => {
  const [notifWindowOpen, setNotifWindowOpen] = useState(false);
  const [notifMsg, setNotifMsg] = useState('');
  const [running, setRunning] = useState(false);
  const [playbackSpeed, _setPlaybackSpeed] = useState(1);
  const setPlaybackSpeed = (speed: number) => {
    if (speed >= 0.5 && speed <= 16) {
      _setPlaybackSpeed(speed);
      main.speed = speed;
    }
  };
  const [visualScale, _setVisualScale] = useState(0.5);
  const setVisualScale = (scale: number) => {
    if (scale >= 0.25 && scale <= 2) {
      _setVisualScale(scale);
    }
  };
  const [isReady, setReady] = useState(false);
  const [selectedTileData, setTileData] = useState<FrameTileData>(null);
  const [game, setGame] = useState<Phaser.Game>(null);
  const [main, setMain] = useState<MainScene>(null);
  const [configs, setConfigs] = useState<LuxMatchConfigs>(null);
  const [sliderConfigs, setSliderConfigs] = useState({
    step: 1,
    min: 0,
    max: 1000,
  });
  useEffect(() => {
    if (game) {
      game.events.on('setup', () => {
        const main: MainScene = game.scene.scenes[0];
        setMain(main);
        const configs = main.luxgame.configs;
        setConfigs(configs as LuxMatchConfigs);

        setSliderConfigs({
          min: 0,
          max: configs.parameters.MAX_DAYS,
          step: 1,
        });
        setReady(true);
      });
    }
  }, [game]);

  useEffect(() => {
    if (running && configs) {
      let currTurn = turn;
      const interval = setInterval(() => {
        if (currTurn >= configs.parameters.MAX_DAYS) {
          setRunning(false);
          return;
        }
        moveToTurn(currTurn);
        currTurn += 1;
        setTurn(currTurn);
      }, 1000 / playbackSpeed);
      return () => clearInterval(interval);
    }
  }, [running, playbackSpeed]);

  useEffect(() => {
    if (isReady) {
      moveToTurn(0);
    }
  }, [isReady]);
  useEffect(() => {
    if (main && visualScale) {
      main.overallScale = visualScale;
      if (main.activeImageTile) {
        // main.activeImageTile.setY(main.originalTileY);
        // main.activeImageTile.clearTint();
        // main.activeImageTile = null;
        // main.originalTileY
      }
      // move to current turn to rerender all objects appropriately
      moveToTurn(turn);
      // TODO: do a on scale change instead inside main
      main.floorImageTiles.forEach((tileImage, hash) => {
        const pos = hashToMapPosition(hash);
        const ps = mapCoordsToIsometricPixels(pos.x, pos.y, {
          scale: main.overallScale,
          width: main.mapWidth,
          height: main.mapHeight,
        });
        tileImage.setScale(main.defaultScales.block * main.overallScale);
        tileImage.setX(ps[0]);
        tileImage.setY(ps[1]);
        if (tileImage == main.activeImageTile) {
          main.originalTileY = tileImage.y;
        }
        if (tileImage == main.hoverImageTile) {
          main.originalHoverImageTileY = tileImage.y;
        }
      });
    }
  }, [main, visualScale]);
  const [turn, setTurn] = useState(0);
  const [currentFrame, setFrame] = useState<Frame>(null);
  const [uploading, setUploading] = useState(false);
  const handleChange = (_event: any, newValue: number) => {
    moveToTurn(newValue);
  };
  const fileInput = React.createRef<HTMLInputElement>();
  const moveToTurn = (turn: number) => {
    setTurn(turn);
    main.renderFrame(turn);
    setFrame(main.frames[turn]);
  };
  const handleUpload = () => {
    setUploading(true);
    if (fileInput.current.files.length) {
      const file = fileInput.current.files[0];
      const name = file.name;
      const meta = name.split('.');

      if (meta[meta.length - 1] === 'json') {
        file
          .text()
          .then(JSON.parse)
          .then((data) => {
            if (game) {
              game.destroy(true, false);
            }
            setReady(false);
            const newgame = createGame({
              replayData: data,
              handleUnitClicked,
              handleTileClicked,
            });
            setGame(newgame);
            setUploading(false);
          });
      }
    }
  };
  useEffect(() => {
    const newgame = createGame({
      replayData: replayData,
      handleUnitClicked,
      handleTileClicked,
    });
    setGame(newgame);
    setUploading(false);
  }, []);
  const renderUploadButton = () => {
    return (
      <Button variant="contained" component="label">
        Upload Replay{' '}
        <input
          accept=".json, .luxr"
          type="file"
          style={{ display: 'none' }}
          onChange={handleUpload}
          ref={fileInput}
        />
      </Button>
    );
  };
  const noUpload = !uploading && game === null;
  const gameLoading =
    (uploading && game === null) || (!isReady && game !== null);

  const handleUnitClicked = (data) => {
    console.log(data);
  };
  const handleTileClicked = (data) => {
    setTileData(data);
  };
  return (
    <div className="Game">
      <div id="content"></div>
      <div className="controller">
        <div className="turn-label">
          <span>Turn {turn}</span>
        </div>
        <div>
          <div className="daytime">
            <img className="day-icon" src={DayTimeSVG} />
            <span>Daytime</span>
          </div>
          <Slider
            className="slider"
            value={turn}
            disabled={!isReady}
            onChange={handleChange}
            aria-labelledby="continuous-slider"
            min={sliderConfigs.min}
            step={sliderConfigs.step}
            max={sliderConfigs.max}
          />
          <div className="nighttime">
            <img className="night-icon" src={NightTimeSVG} />
            <span>Nighttime</span>
          </div>
        </div>
        <div className="replay-buttons">
          <IconButton aria-label="restart">
            <img src={ReplayButtonSVG} />
          </IconButton>
          <IconButton aria-label="options">
            <img src={OptionsSVG} />
          </IconButton>
          <IconButton
            aria-label="leftarrow"
            onClick={() => {
              setPlaybackSpeed(playbackSpeed / 2);
            }}
          >
            <img src={ArrowsSVG} />
          </IconButton>
          <IconButton
            aria-label="pause"
            className="pause-button"
            disabled={!isReady}
            onClick={() => {
              setRunning(!running);
            }}
          >
            <div className="pause-circle">
              {running ? (
                <img className="pause-icon" src={PauseButtonSVG} />
              ) : (
                // {/*TODO: change this to play icon*/}
                <div style={{ color: 'white', zIndex: 999 }}>{'>'}</div>
              )}
            </div>
          </IconButton>
          <IconButton
            aria-label="rightarrow"
            onClick={() => {
              setPlaybackSpeed(playbackSpeed * 2);
            }}
          >
            <img className="right-arrow-icon" src={ArrowsSVG} />
          </IconButton>
          <IconButton
            aria-label="zoomin"
            onClick={() => {
              setVisualScale(visualScale + 0.25);
            }}
          >
            +
          </IconButton>
          <IconButton
            aria-label="zoomout"
            onClick={() => {
              setVisualScale(visualScale - 0.25);
            }}
          >
            -
          </IconButton>
          <div className="speed-display">{playbackSpeed}x</div>
        </div>
      </div>
      <Card
        className={classnames({
          'phaser-wrapper': true,
          Loading: gameLoading,
          slider: true,
        })}
      >
        <CardContent>
          {noUpload && renderUploadButton()}
          {gameLoading && <CircularProgress />}

          <div className="play-buttons">
            <ButtonGroup disabled={!isReady}>
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => {
                const variant = visualScale === s ? 'contained' : 'outlined';
                return (
                  <Button
                    color="primary"
                    variant={variant}
                    onClick={() => {
                      setVisualScale(s);
                    }}
                  >
                    {s}x Scale
                  </Button>
                );
              })}
            </ButtonGroup>
          </div>
        </CardContent>
      </Card>
      <div className="tile-stats-wrapper">
        {selectedTileData ? (
          <TileStats {...selectedTileData} cities={currentFrame.cityData} />
        ) : (
          <TileStats empty />
        )}
      </div>
      <div className="global-stats-wrapper">
        <GlobalStats
          currentFrame={currentFrame}
          teamDetails={replayData.teamDetails}
        />
      </div>
      {!noUpload && renderUploadButton()}
    </div>
  );
};
