import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import HomePage from './pages/HomePage'

describe('App', () => {
  it('renders homepage without crashing', () => {
    render(
      <BrowserRouter>
        <HomePage />
      </BrowserRouter>
    )
    
    expect(screen.getAllByText('BoosterBeacon')).toHaveLength(2) // Nav and footer
    expect(screen.getByText('Get Started')).toBeInTheDocument()
    expect(screen.getByText('Pricing')).toBeInTheDocument()
  })
})