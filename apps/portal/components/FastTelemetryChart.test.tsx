import { FastTelemetryChart } from '@repo/ui/components/ui/FastTelemetryChart';
import { render, screen } from '@testing-library/react';
import React from 'react';

describe('FastTelemetryChart', () => {
  beforeAll(() => {
    // Mock HTMLCanvasElement getContext
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
      save: jest.fn(),
      restore: jest.fn(),
      scale: jest.fn(),
      clearRect: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      stroke: jest.fn(),
      fill: jest.fn(),
      closePath: jest.fn(),
      fillText: jest.fn(),
      createLinearGradient: jest.fn(() => ({
        addColorStop: jest.fn(),
      })),
      strokeStyle: '',
      lineWidth: 1,
      fillStyle: '',
      font: '',
      textAlign: '',
      textBaseline: '',
      lineJoin: '',
      lineCap: '',
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  it('renders canvas element and title without crashing', () => {
    const sampleData = [
      { timestamp: '10:00', value: 120 },
      { timestamp: '10:01', value: 135 },
      { timestamp: '10:02', value: 128 },
    ];

    render(<FastTelemetryChart data={sampleData} title="Drill Bit RPM" unit="RPM" />);

    expect(screen.getByText('Drill Bit RPM')).toBeInTheDocument();
    expect(screen.getByText(/Canvas 2D 60 FPS/i)).toBeInTheDocument();
  });
});
