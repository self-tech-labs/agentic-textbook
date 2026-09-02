import { useState } from "react";
import type { MediaBlock } from "../../domain/agentCanvas";

export default function GovernedMedia({ block }: { block: MediaBlock }) {
  const [failed, setFailed] = useState(false);
  const asset = block.asset;
  const source = asset.url || "/media/" + encodeURIComponent(asset.id);

  if (failed || asset.status !== "ready") {
    return (
      <aside className="rich-fallback" role="note">
        <strong>{asset.caption}</strong>
        <p>
          {asset.kind === "image"
            ? asset.alt
            : asset.transcript || "This governed media asset is unavailable."}
        </p>
        <small>{asset.attribution} · Rights: {asset.rightsBasis}</small>
      </aside>
    );
  }

  return (
    <figure className="media-block">
      {asset.kind === "image" ? (
        <img
          src={source}
          alt={asset.alt || ""}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : null}
      {asset.kind === "audio" ? (
        <audio
          controls
          preload="metadata"
          src={source}
          onError={() => setFailed(true)}
        >
          Your browser does not support native audio playback.
        </audio>
      ) : null}
      {asset.kind === "video" ? (
        <video
          controls
          preload="metadata"
          src={source}
          onError={() => setFailed(true)}
        >
          {asset.captionsVtt ? (
            <track
              default
              kind="captions"
              src={asset.captionsVtt}
              srcLang="en"
              label="English"
            />
          ) : null}
          Your browser does not support native video playback.
        </video>
      ) : null}
      <figcaption>
        <strong>{asset.caption}</strong>
        <span>{asset.attribution}</span>
        <span>Rights: {asset.rightsBasis}</span>
      </figcaption>
      {asset.transcript ? (
        <details className="media-transcript">
          <summary>Transcript</summary>
          <p>{asset.transcript}</p>
        </details>
      ) : null}
    </figure>
  );
}
