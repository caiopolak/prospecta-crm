import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the Prospecta CRM navigation', () => {
  render(<App />);
  expect(screen.getByText(/prospecta/i)).toBeInTheDocument();
});
