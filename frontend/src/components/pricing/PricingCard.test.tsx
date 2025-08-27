import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import PricingCard from './PricingCard';
import { PricingPlan } from '../../constants/pricing';

const mockPlan: PricingPlan = {
  id: 'test-plan',
  name: 'Test Plan',
  price: '$9.99',
  period: 'month',
  description: 'Test description',
  features: ['Feature 1', 'Feature 2', 'Feature 3'],
  cta: 'Get Started',
  href: '/register',
  popular: false
};

const mockPopularPlan: PricingPlan = {
  ...mockPlan,
  popular: true,
  badge: 'Most Popular'
};

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('PricingCard', () => {
  it('renders plan information correctly', () => {
    renderWithRouter(<PricingCard plan={mockPlan} />);
    
    expect(screen.getByText('Test Plan')).toBeInTheDocument();
    expect(screen.getByText('$9.99')).toBeInTheDocument();
    expect(screen.getByText('/month')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
    expect(screen.getByText('Get Started')).toBeInTheDocument();
  });

  it('renders all features', () => {
    renderWithRouter(<PricingCard plan={mockPlan} />);
    
    expect(screen.getByText('Feature 1')).toBeInTheDocument();
    expect(screen.getByText('Feature 2')).toBeInTheDocument();
    expect(screen.getByText('Feature 3')).toBeInTheDocument();
  });

  it('shows popular badge when plan is popular', () => {
    renderWithRouter(<PricingCard plan={mockPopularPlan} />);
    
    expect(screen.getByText('Most Popular')).toBeInTheDocument();
  });

  it('does not show popular badge when plan is not popular', () => {
    renderWithRouter(<PricingCard plan={mockPlan} />);
    
    expect(screen.queryByText('Most Popular')).not.toBeInTheDocument();
  });

  it('applies correct styling for popular plans', () => {
    const { container } = renderWithRouter(<PricingCard plan={mockPopularPlan} />);
    
    const cardElement = container.firstChild as HTMLElement;
    expect(cardElement).toHaveClass('ring-2', 'ring-pokemon-electric');
  });

  it('has correct link href', () => {
    renderWithRouter(<PricingCard plan={mockPlan} />);
    
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/register');
  });

  it('has proper accessibility attributes', () => {
    renderWithRouter(<PricingCard plan={mockPlan} />);
    
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('aria-label', 'Get Started - Test Plan plan');
    
    const featuresList = screen.getByRole('list');
    expect(featuresList).toBeInTheDocument();
    expect(featuresList).toHaveAttribute('aria-label', 'Test Plan plan features');
  });

  it('calls onCardClick when card is clicked', () => {
    const mockOnCardClick = vi.fn();
    renderWithRouter(<PricingCard plan={mockPlan} onCardClick={mockOnCardClick} />);
    
    const card = screen.getByTestId('pricing-card-test-plan');
    card.click();
    
    expect(mockOnCardClick).toHaveBeenCalledWith('test-plan');
  });

  it('uses custom testId when provided', () => {
    renderWithRouter(<PricingCard plan={mockPlan} testId="custom-test-id" />);
    
    expect(screen.getByTestId('custom-test-id')).toBeInTheDocument();
  });

  it('handles forever period correctly', () => {
    const foreverPlan = { ...mockPlan, period: 'forever' };
    renderWithRouter(<PricingCard plan={foreverPlan} />);
    
    expect(screen.queryByText('/forever')).not.toBeInTheDocument();
  });
});