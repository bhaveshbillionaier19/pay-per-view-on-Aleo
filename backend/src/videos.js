export const videos = [
  {
    id: '1',
    title: 'Video 1',
    videoId: 'IXPhLr7zd30',
    price: 1,
  },
  {
    id: '2',
    title: 'Video 2',
    videoId: 'PfHxw_CvRKg',
    price: 1,
  },
  {
    id: '3',
    title: 'Video 3',
    videoId: '0WEZCI-Xoaw',
    price: 1,
  },
];

export function getVideoById(id) {
  return videos.find((video) => video.id === id) || null;
}

