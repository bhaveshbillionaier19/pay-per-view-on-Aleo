import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000',
  timeout: 10000,
});

export async function fetchVideos() {
  const { data } = await api.get('/videos');
  return data.videos;
}

export async function fetchPaymentConfig() {
  const { data } = await api.get('/payment-config');
  return data;
}

export async function verifyPayment(payload) {
  const { data } = await api.post('/verify-payment', payload);
  return data;
}

export async function discoverPayment(payload) {
  const { data } = await api.post('/discover-payment', payload);
  return data;
}

export async function fetchVideoAccess(videoId, token) {
  const { data } = await api.get(`/video/${videoId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return data;
}

export default api;
