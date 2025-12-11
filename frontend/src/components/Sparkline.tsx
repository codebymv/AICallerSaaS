'use client';

import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface SparklineProps {
  data: { date: string; value: number }[];
  color?: string;
  strokeWidth?: number;
}

export function Sparkline({ data, color = '#0d9488', strokeWidth = 2 }: SparklineProps) {
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={strokeWidth}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

