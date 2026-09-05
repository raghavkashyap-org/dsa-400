import { useEffect, useRef } from 'react';
import { registerVideo, seekAllVideos } from '../../lib/note-video';

/* YouTube embed — registers itself so timestamp chips can seek into it.
   opts lets the author control playback:
     { autoplay, loop, start, mute }                                 */
export function VideoEmbed({ videoId, title, opts = {} }) {
  const ref = useRef(null);
  useEffect(() => registerVideo(ref.current), [videoId]);

  const { autoplay, loop, start, mute } = opts || {};
  const params = new URLSearchParams({
    enablejsapi: '1',
    rel: '0',
    modestbranding: '1',
    controls: '1',      // always give the user the controls
    playsinline: '1',
    fs: '1',
    iv_load_policy: '3',
  });
  if (autoplay) {
    params.set('autoplay', '1');
    // browsers only allow autoplay when muted
    params.set('mute', '1');
  } else if (mute) {
    params.set('mute', '1');
  }
  if (loop) { params.set('loop', '1'); params.set('playlist', videoId); }
  if (start > 0) params.set('start', String(start));

  return (
    <figure className="n-video">
      <div className="n-video-box">
        <iframe
          ref={ref}
          src={`https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`}
          title={title || 'video'}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
        />
      </div>
      {title ? <figcaption className="n-video-cap">{title}</figcaption> : null}
    </figure>
  );
}

/* Clickable [12:34] timestamp → seek the video. */
export function Timestamp({ seconds, label }) {
  return (
    <button
      className="n-ts"
      type="button"
      title={`Jump to ${label}`}
      onClick={() => seekAllVideos(seconds)}
    >
      ▶ {label}
    </button>
  );
}
