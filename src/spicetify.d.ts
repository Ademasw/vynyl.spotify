// Minimal typings for the parts of the global Spicetify API this app uses.

declare module "*.css" {
  const css: string;
  export default css;
}

type SpicetifyTrackMetadata = {
  title?: string;
  artist_name?: string;
  image_xlarge_url?: string;
  image_large_url?: string;
  image_url?: string;
};

type SpicetifyPlayerEvent = "songchange" | "onplaypause" | "onprogress";

declare const Spicetify: {
  React: {
    createElement(type: unknown, props?: unknown, ...children: unknown[]): unknown;
    useRef<T>(initial: T | null): { current: T | null };
    useEffect(effect: () => void | (() => void), deps?: unknown[]): void;
  };
  Player: {
    data?: { item?: { uri?: string; metadata?: SpicetifyTrackMetadata } | null } | null;
    addEventListener(type: SpicetifyPlayerEvent, cb: (event?: unknown) => void): void;
    removeEventListener(type: SpicetifyPlayerEvent, cb: (event?: unknown) => void): void;
    getProgress(): number;
    getDuration(): number;
    isPlaying(): boolean;
    togglePlay(): void;
    next(): void;
    back(): void;
    seek(position: number): void;
    getHeart?(): boolean;
    toggleHeart?(): void;
    getShuffle?(): boolean;
    toggleShuffle?(): void;
    /** 0 = off, 1 = context, 2 = track */
    getRepeat?(): number;
    toggleRepeat?(): void;
  };
  Queue?: {
    nextTracks?: Array<{ contextTrack?: { uri?: string; metadata?: SpicetifyTrackMetadata } }>;
  };
  Platform?: { History?: { push(path: string): void } };
  CosmosAsync: { get(url: string): Promise<unknown> };
  colorExtractor(uri: string): Promise<Record<string, string>>;
};
