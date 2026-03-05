import { SiteStatus } from './types';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const generateHistory = (base: number, variance: number, type: 'temperature' | 'humidity' | 'smoke', count: number = 24) => {
  const now = Date.now();
  return Array.from({ length: count }).map((_, i) => {
    const timestamp = now - (count - i) * 3600000; // 1 hour intervals
    const hour = new Date(timestamp).getHours();
    
    let value = base;
    
    if (type === 'temperature') {
      // Diurnal cycle: peaks at 3 PM (15:00), lowest at 4 AM
      const cycle = Math.sin((hour - 9) * Math.PI / 12);
      value += cycle * 5 + (Math.random() - 0.5) * variance;
    } else if (type === 'humidity') {
      // Inverse of temperature
      const cycle = Math.sin((hour - 21) * Math.PI / 12);
      value += cycle * 15 + (Math.random() - 0.5) * variance;
    } else {
      // Smoke is more random but has occasional spikes
      value += (Math.random() > 0.95 ? Math.random() * 50 : (Math.random() - 0.5) * variance);
    }
    
    return { timestamp, value };
  });
};

export const MOCK_SITES: SiteStatus[] = [
  {
    id: 'site-001',
    name: 'North Ridge Tower',
    location: '40.7128° N, 74.0060° W',
    status: 'online',
    lastUpdate: Date.now(),
    sensors: {
      temperature: {
        current: 24.5,
        unit: '°C',
        history: generateHistory(22, 2, 'temperature'),
        threshold: 45,
      },
      humidity: {
        current: 45,
        unit: '%',
        history: generateHistory(50, 5, 'humidity'),
        threshold: 80,
      },
      smoke: {
        current: 12,
        unit: 'ppm',
        history: generateHistory(10, 4, 'smoke'),
        threshold: 50,
      },
    },
  },
  {
    id: 'site-002',
    name: 'Downtown Hub',
    location: '34.0522° N, 118.2437° W',
    status: 'warning',
    lastUpdate: Date.now(),
    sensors: {
      temperature: {
        current: 38.2,
        unit: '°C',
        history: generateHistory(32, 4, 'temperature'),
        threshold: 45,
      },
      humidity: {
        current: 62,
        unit: '%',
        history: generateHistory(65, 8, 'humidity'),
        threshold: 80,
      },
      smoke: {
        current: 15,
        unit: 'ppm',
        history: generateHistory(12, 5, 'smoke'),
        threshold: 50,
      },
    },
  },
  {
    id: 'site-003',
    name: 'East Valley Station',
    location: '41.8781° N, 87.6298° W',
    status: 'critical',
    lastUpdate: Date.now(),
    sensors: {
      temperature: {
        current: 52.1,
        unit: '°C',
        history: generateHistory(48, 10, 'temperature'),
        threshold: 45,
      },
      humidity: {
        current: 30,
        unit: '%',
        history: generateHistory(35, 5, 'humidity'),
        threshold: 80,
      },
      smoke: {
        current: 1, // ALARM ACTIVE
        unit: 'digital',
        history: [...generateHistory(0, 0, 'smoke', 20), { timestamp: Date.now() - 3600000, value: 1 }, { timestamp: Date.now(), value: 1 }],
        threshold: 0.5,
      },
    },
  },
];
