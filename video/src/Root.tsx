import "./index.css";
import {Composition} from "remotion";
import {
  DEMO_DURATION_IN_FRAMES,
  DemoRoughCut,
  FPS,
} from "./Composition";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="OgramLearnDemoRoughCutV2"
      component={DemoRoughCut}
      durationInFrames={DEMO_DURATION_IN_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
    />
  );
};
