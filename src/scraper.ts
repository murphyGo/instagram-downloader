export type Media = {
  type: 'image' | 'video';
  url: string;
  filename?: string;
};

export type FetchOptions = {
  proxyUrl?: string;
};

export async function fetchMedia(
  _postUrl: string,
  _opts: FetchOptions = {},
): Promise<Media[]> {
  throw new Error('fetchMedia not implemented yet');
}
