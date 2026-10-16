import { ImageResponse } from 'next/og';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';
// Same gradient, radius and J as the homepage. No screenshot or remote font.
export default function AppleIcon() {
  return new ImageResponse(<div style={{ width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 48, background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' }}><svg width="180" height="180" viewBox="0 0 52 52"><path fill="#fff" d="M27.568 17.879H30.791V28.707Q30.791 31.049 29.287 32.392Q27.783 33.734 25.549 33.734Q23.25 33.734 21.773 32.558Q20.296 31.382 20.296 28.9H23.529Q23.529 30.157 24.077 30.646Q24.625 31.135 25.549 31.135Q26.473 31.135 27.021 30.501Q27.568 29.867 27.568 28.707Z"/></svg></div>, size);
}
