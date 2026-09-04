import {Video} from "@remotion/media";
import type {CSSProperties, ReactNode} from "react";
import {
  AbsoluteFill,
  interpolate,
  Series,
  staticFile,
  useCurrentFrame,
} from "remotion";

export const FPS = 30;
export const DEMO_DURATION_IN_FRAMES = 5022;

const capture = staticFile("raw/full-capture-original-duplicate.mov");
const openingCapture = staticFile(
  "raw/opening-wow-effect-original-duplicate.mov",
);

const stageStyle: CSSProperties = {
  backgroundColor: "#050505",
  overflow: "hidden",
};

const baseVideoStyle: CSSProperties = {
  height: "100%",
  width: "100%",
};

const ChapterLabel: React.FC<{children: ReactNode}> = ({children}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 8, 66, 90], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(frame, [0, 12], [10, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        alignItems: "center",
        backgroundColor: "rgba(12, 12, 12, 0.88)",
        border: "1px solid rgba(184, 255, 52, 0.9)",
        borderRadius: 14,
        boxShadow: "0 14px 34px rgba(0, 0, 0, 0.24)",
        color: "white",
        display: "flex",
        fontFamily:
          "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, sans-serif",
        fontSize: 29,
        fontWeight: 650,
        left: 48,
        letterSpacing: "-0.02em",
        lineHeight: 1.15,
        maxWidth: 960,
        opacity,
        padding: "16px 21px 17px",
        position: "absolute",
        top: 48,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <span
        style={{
          backgroundColor: "#b8ff34",
          borderRadius: 999,
          flex: "0 0 auto",
          height: 12,
          marginRight: 14,
          width: 12,
        }}
      />
      {children}
    </div>
  );
};

export const DemoRoughCut: React.FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: "#050505"}}>
      <Series>
        {/* 00:00-00:17.5 — supplied interactive slope scene */}
        <Series.Sequence durationInFrames={525}>
          <AbsoluteFill style={stageStyle}>
            <Video
              muted
              objectFit="cover"
              src={openingCapture}
              trimBefore={0}
              trimAfter={525}
              style={{
                ...baseVideoStyle,
                transform: "scale(1.29)",
                transformOrigin: "100% 50%",
              }}
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* Existing rough-cut timestamps below are relative to its new 00:17.5 start. */}
        {/* 00:00-00:06 — Source 08:20.3-08:26.3 — immediate product proof */}
        <Series.Sequence durationInFrames={180}>
          <AbsoluteFill style={stageStyle}>
            <Video
              muted
              objectFit="cover"
              src={capture}
              trimBefore={15009}
              trimAfter={15189}
              style={{
                ...baseVideoStyle,
                transform: "scale(1.35)",
                transformOrigin: "100% 50%",
              }}
            />
            <ChapterLabel>
              A tailored lesson, built and controlled from Codex
            </ChapterLabel>
          </AbsoluteFill>
        </Series.Sequence>

        {/* 00:06-00:14 — Source 10:30-10:38 — adaptive interaction teaser */}
        <Series.Sequence durationInFrames={240}>
          <AbsoluteFill style={stageStyle}>
            <Video
              muted
              objectFit="cover"
              src={capture}
              trimBefore={18900}
              trimAfter={19140}
              style={{
                ...baseVideoStyle,
                transform: "scale(1.5)",
                transformOrigin: "100% 50%",
              }}
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 00:14-00:28 — Source 01:33-01:48.4 at 1.1x — learning brief */}
        <Series.Sequence durationInFrames={420}>
          <AbsoluteFill style={stageStyle}>
            <Video
              muted
              objectFit="cover"
              playbackRate={1.1}
              src={capture}
              trimBefore={2790}
              trimAfter={3252}
              style={{
                ...baseVideoStyle,
                transform: "scale(1.46)",
                transformOrigin: "100% 50%",
              }}
            />
            <ChapterLabel>1. Define the learning outcome</ChapterLabel>
          </AbsoluteFill>
        </Series.Sequence>

        {/* 00:28-00:35 — Source 01:56-02:03 — hand the brief to Codex */}
        <Series.Sequence durationInFrames={210}>
          <AbsoluteFill style={stageStyle}>
            <Video
              muted
              objectFit="cover"
              src={capture}
              trimBefore={3480}
              trimAfter={3690}
              style={{
                ...baseVideoStyle,
                transform: "scale(1.38)",
                transformOrigin: "100% 50%",
              }}
            />
            <ChapterLabel>
              2. Codex drives the canvas through WebMCP
            </ChapterLabel>
          </AbsoluteFill>
        </Series.Sequence>

        {/* 00:35-00:42 — Source 02:44-02:54.5 at 1.5x — tool discovery */}
        <Series.Sequence durationInFrames={210}>
          <AbsoluteFill style={stageStyle}>
            <Video
              muted
              objectFit="cover"
              playbackRate={1.5}
              src={capture}
              trimBefore={4920}
              trimAfter={5235}
              style={{
                ...baseVideoStyle,
                transform: "scale(1.29)",
                transformOrigin: "100% 50%",
              }}
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 00:42-00:59.9 — Source 04:23.5-04:44.1 at 1.15x — context approval */}
        <Series.Sequence durationInFrames={537}>
          <AbsoluteFill style={stageStyle}>
            <Video
              muted
              objectFit="cover"
              playbackRate={1.15}
              src={capture}
              trimBefore={7905}
              trimAfter={8523}
              style={{
                ...baseVideoStyle,
                transform: "scale(1.46)",
                transformOrigin: "100% 50%",
              }}
            />
            <ChapterLabel>3. Approve or correct context before use</ChapterLabel>
          </AbsoluteFill>
        </Series.Sequence>

        {/* 00:59.9-01:02.9 — Source 05:07.5-05:10.5 — start authoring */}
        <Series.Sequence durationInFrames={90}>
          <AbsoluteFill style={stageStyle}>
            <Video
              muted
              objectFit="cover"
              src={capture}
              trimBefore={9225}
              trimAfter={9315}
              style={{
                ...baseVideoStyle,
                transform: "scale(1.29)",
                transformOrigin: "100% 50%",
              }}
            />
            <ChapterLabel>4. Watch the lesson take shape</ChapterLabel>
          </AbsoluteFill>
        </Series.Sequence>

        {/* 01:02.9-01:11.9 — Source 05:10.5-07:19.5 at 14.33x — cut the wait */}
        <Series.Sequence durationInFrames={270}>
          <AbsoluteFill style={stageStyle}>
            <Video
              muted
              objectFit="cover"
              playbackRate={14.3333333333}
              src={capture}
              trimBefore={9315}
              trimAfter={13185}
              style={{
                ...baseVideoStyle,
                transform: "scale(1.29)",
                transformOrigin: "100% 50%",
              }}
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 01:11.9-01:17.9 — Source 07:19.5-07:25.5 — lesson ready */}
        <Series.Sequence durationInFrames={180}>
          <AbsoluteFill style={stageStyle}>
            <Video
              muted
              objectFit="cover"
              src={capture}
              trimBefore={13185}
              trimAfter={13365}
              style={{
                ...baseVideoStyle,
                transform: "scale(1.38)",
                transformOrigin: "100% 50%",
              }}
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 01:17.9-01:25.9 — Source 07:30-07:38 — review and approve */}
        <Series.Sequence durationInFrames={240}>
          <AbsoluteFill style={stageStyle}>
            <Video
              muted
              objectFit="cover"
              src={capture}
              trimBefore={13500}
              trimAfter={13740}
              style={{
                ...baseVideoStyle,
                transform: "scale(1.46)",
                transformOrigin: "100% 50%",
              }}
            />
            <ChapterLabel>5. Review, approve, and publish</ChapterLabel>
          </AbsoluteFill>
        </Series.Sequence>

        {/* 01:25.9-01:29.9 — Source 07:39-07:49 at 2.5x — inspect sections */}
        <Series.Sequence durationInFrames={120}>
          <AbsoluteFill style={stageStyle}>
            <Video
              muted
              objectFit="cover"
              playbackRate={2.5}
              src={capture}
              trimBefore={13770}
              trimAfter={14070}
              style={{
                ...baseVideoStyle,
                transform: "scale(1.46)",
                transformOrigin: "100% 50%",
              }}
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 01:29.9-01:33.9 — Source 07:57-08:08 at 2.75x — publish command */}
        <Series.Sequence durationInFrames={120}>
          <AbsoluteFill style={stageStyle}>
            <Video
              muted
              objectFit="cover"
              playbackRate={2.75}
              src={capture}
              trimBefore={14310}
              trimAfter={14640}
              style={{
                ...baseVideoStyle,
                transform: "scale(1.29)",
                transformOrigin: "100% 50%",
              }}
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 01:33.9-01:37.9 — Source 08:08.5-08:12.5 — open published lesson */}
        <Series.Sequence durationInFrames={120}>
          <AbsoluteFill style={stageStyle}>
            <Video
              muted
              objectFit="cover"
              src={capture}
              trimBefore={14655}
              trimAfter={14775}
              style={{
                ...baseVideoStyle,
                transform: "scale(1.38)",
                transformOrigin: "100% 50%",
              }}
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 01:37.9-01:44.9 — Source 08:25.5-08:32.5 — concise explanation */}
        <Series.Sequence durationInFrames={210}>
          <AbsoluteFill style={stageStyle}>
            <Video
              muted
              objectFit="cover"
              src={capture}
              trimBefore={15165}
              trimAfter={15375}
              style={{
                ...baseVideoStyle,
                transform: "scale(1.5)",
                transformOrigin: "100% 50%",
              }}
            />
            <ChapterLabel>A real lesson—not a wall of text</ChapterLabel>
          </AbsoluteFill>
        </Series.Sequence>

        {/* 01:44.9-01:51.9 — Source 08:49.5-08:56.5 — diagram and sources */}
        <Series.Sequence durationInFrames={210}>
          <AbsoluteFill style={stageStyle}>
            <Video
              muted
              objectFit="cover"
              src={capture}
              trimBefore={15885}
              trimAfter={16095}
              style={{
                ...baseVideoStyle,
                transform: "scale(1.5)",
                transformOrigin: "100% 50%",
              }}
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 01:51.9-01:59.9 — Source 09:08.5-09:16.5 — reviewed signals and checkpoint */}
        <Series.Sequence durationInFrames={240}>
          <AbsoluteFill style={stageStyle}>
            <Video
              muted
              objectFit="cover"
              src={capture}
              trimBefore={16455}
              trimAfter={16695}
              style={{
                ...baseVideoStyle,
                transform: "scale(1.5)",
                transformOrigin: "100% 50%",
              }}
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 01:59.9-02:03.9 — Source 10:04-10:08 — ask Codex to simplify */}
        <Series.Sequence durationInFrames={120}>
          <AbsoluteFill style={stageStyle}>
            <Video
              muted
              objectFit="cover"
              src={capture}
              trimBefore={18120}
              trimAfter={18240}
              style={{
                ...baseVideoStyle,
                transform: "scale(1.29)",
                transformOrigin: "100% 50%",
              }}
            />
            <ChapterLabel>Ask Codex when the lesson is unclear</ChapterLabel>
          </AbsoluteFill>
        </Series.Sequence>

        {/* 02:03.9-02:10.9 — Source 10:17.5-10:24.5 — Codex explains */}
        <Series.Sequence durationInFrames={210}>
          <AbsoluteFill style={stageStyle}>
            <Video
              muted
              objectFit="cover"
              src={capture}
              trimBefore={18525}
              trimAfter={18735}
              style={{
                ...baseVideoStyle,
                transform: "scale(1.29)",
                transformOrigin: "100% 50%",
              }}
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 02:10.9-02:16.9 — Source 10:25.5-10:34.5 at 1.5x — answer and evidence */}
        <Series.Sequence durationInFrames={180}>
          <AbsoluteFill style={stageStyle}>
            <Video
              muted
              objectFit="cover"
              playbackRate={1.5}
              src={capture}
              trimBefore={18765}
              trimAfter={19035}
              style={{
                ...baseVideoStyle,
                transform: "scale(1.5)",
                transformOrigin: "100% 50%",
              }}
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 02:16.9-02:20.9 — Source 10:36-10:40 — transfer task */}
        <Series.Sequence durationInFrames={120}>
          <AbsoluteFill style={stageStyle}>
            <Video
              muted
              objectFit="cover"
              src={capture}
              trimBefore={19080}
              trimAfter={19200}
              style={{
                ...baseVideoStyle,
                transform: "scale(1.5)",
                transformOrigin: "100% 50%",
              }}
            />
            <ChapterLabel>Turn learning into the next action</ChapterLabel>
          </AbsoluteFill>
        </Series.Sequence>

        {/* 02:20.9-02:23.9 — Source 10:40-10:57 at 5.67x — cut live typing */}
        <Series.Sequence durationInFrames={90}>
          <AbsoluteFill style={stageStyle}>
            <Video
              muted
              objectFit="cover"
              playbackRate={5.6666666667}
              src={capture}
              trimBefore={19200}
              trimAfter={19710}
              style={{
                ...baseVideoStyle,
                transform: "scale(1.5)",
                transformOrigin: "100% 50%",
              }}
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 02:23.9-02:25.9 — Source 11:04.5-11:08.5 at 2x — save evidence */}
        <Series.Sequence durationInFrames={60}>
          <AbsoluteFill style={stageStyle}>
            <Video
              muted
              objectFit="cover"
              playbackRate={2}
              src={capture}
              trimBefore={19935}
              trimAfter={20055}
              style={{
                ...baseVideoStyle,
                transform: "scale(1.5)",
                transformOrigin: "100% 50%",
              }}
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 02:25.9-02:29.9 — Source 11:10-11:14 — finished lesson */}
        <Series.Sequence durationInFrames={120}>
          <AbsoluteFill style={stageStyle}>
            <Video
              muted
              objectFit="cover"
              src={capture}
              trimBefore={20100}
              trimAfter={20220}
              style={{
                ...baseVideoStyle,
                transform: "scale(1.5)",
                transformOrigin: "100% 50%",
              }}
            />
          </AbsoluteFill>
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
