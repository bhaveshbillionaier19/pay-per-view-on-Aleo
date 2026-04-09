export const videos = [
  {
    id: '1',
    title: 'Private Access Overview',
    videoId: 'IXPhLr7zd30',
    price: 1,
    duration: '04:12',
    category: 'Product Demo',
    summary: 'A quick walkthrough of the wallet-pay-to-view flow and private access experience.',
  },
  {
    id: '2',
    title: 'Sample Implementation Walkthrough',
    videoId: 'PfHxw_CvRKg',
    price: 1,
    duration: '06:44',
    category: 'Featured Sample',
    summary: 'A featured implementation video for demos, investor walkthroughs, and product presentations.',
    featured: true,
  },
  {
    id: '3',
    title: 'ZK Payment Verification',
    videoId: '0WEZCI-Xoaw',
    price: 1,
    duration: '05:18',
    category: 'Backend Flow',
    summary: 'A backend-oriented view of transaction verification, one-time access, and secure playback delivery.',
  },
];

export function getVideoById(id) {
  return videos.find((video) => video.id === id) || null;
}
