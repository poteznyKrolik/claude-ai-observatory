import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '../card'

describe('Card', () => {
  it('renders with base styles', () => {
    render(<Card data-testid="card">Content</Card>)
    const card = screen.getByTestId('card')
    expect(card).toHaveClass('rounded-lg')
    expect(card).toHaveClass('border')
    expect(card).toHaveClass('bg-card')
    expect(card).toHaveClass('shadow-sm')
  })

  it('applies custom className', () => {
    render(
      <Card className="custom-class" data-testid="card">
        Content
      </Card>
    )
    const card = screen.getByTestId('card')
    expect(card).toHaveClass('custom-class')
  })

  it('forwards ref', () => {
    const ref = { current: null }
    render(<Card ref={ref}>Content</Card>)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })
})

describe('CardHeader', () => {
  it('renders with base styles', () => {
    render(<CardHeader data-testid="header">Header</CardHeader>)
    const header = screen.getByTestId('header')
    expect(header).toHaveClass('flex')
    expect(header).toHaveClass('flex-col')
    expect(header).toHaveClass('space-y-1.5')
    expect(header).toHaveClass('p-6')
  })

  it('applies custom className', () => {
    render(
      <CardHeader className="custom-class" data-testid="header">
        Header
      </CardHeader>
    )
    expect(screen.getByTestId('header')).toHaveClass('custom-class')
  })

  it('forwards ref', () => {
    const ref = { current: null }
    render(<CardHeader ref={ref}>Header</CardHeader>)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })
})

describe('CardTitle', () => {
  it('renders as h3', () => {
    render(<CardTitle>Title</CardTitle>)
    const title = screen.getByRole('heading', { level: 3, name: 'Title' })
    expect(title).toBeInTheDocument()
  })

  it('renders with base styles', () => {
    render(<CardTitle data-testid="title">Title</CardTitle>)
    const title = screen.getByTestId('title')
    expect(title).toHaveClass('text-2xl')
    expect(title).toHaveClass('font-semibold')
    expect(title).toHaveClass('leading-none')
    expect(title).toHaveClass('tracking-tight')
  })

  it('applies custom className', () => {
    render(
      <CardTitle className="custom-class" data-testid="title">
        Title
      </CardTitle>
    )
    expect(screen.getByTestId('title')).toHaveClass('custom-class')
  })

  it('forwards ref', () => {
    const ref = { current: null }
    render(<CardTitle ref={ref}>Title</CardTitle>)
    expect(ref.current).toBeInstanceOf(HTMLHeadingElement)
  })
})

describe('CardDescription', () => {
  it('renders with base styles', () => {
    render(<CardDescription data-testid="desc">Description</CardDescription>)
    const desc = screen.getByTestId('desc')
    expect(desc).toHaveClass('text-sm')
    expect(desc).toHaveClass('text-muted-foreground')
  })

  it('applies custom className', () => {
    render(
      <CardDescription className="custom-class" data-testid="desc">
        Description
      </CardDescription>
    )
    expect(screen.getByTestId('desc')).toHaveClass('custom-class')
  })

  it('forwards ref', () => {
    const ref = { current: null }
    render(<CardDescription ref={ref}>Description</CardDescription>)
    expect(ref.current).toBeInstanceOf(HTMLParagraphElement)
  })
})

describe('CardContent', () => {
  it('renders with base styles', () => {
    render(<CardContent data-testid="content">Content</CardContent>)
    const content = screen.getByTestId('content')
    expect(content).toHaveClass('p-6')
    expect(content).toHaveClass('pt-0')
  })

  it('applies custom className', () => {
    render(
      <CardContent className="custom-class" data-testid="content">
        Content
      </CardContent>
    )
    expect(screen.getByTestId('content')).toHaveClass('custom-class')
  })

  it('forwards ref', () => {
    const ref = { current: null }
    render(<CardContent ref={ref}>Content</CardContent>)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })
})

describe('CardFooter', () => {
  it('renders with base styles', () => {
    render(<CardFooter data-testid="footer">Footer</CardFooter>)
    const footer = screen.getByTestId('footer')
    expect(footer).toHaveClass('flex')
    expect(footer).toHaveClass('items-center')
    expect(footer).toHaveClass('p-6')
    expect(footer).toHaveClass('pt-0')
  })

  it('applies custom className', () => {
    render(
      <CardFooter className="custom-class" data-testid="footer">
        Footer
      </CardFooter>
    )
    expect(screen.getByTestId('footer')).toHaveClass('custom-class')
  })

  it('forwards ref', () => {
    const ref = { current: null }
    render(<CardFooter ref={ref}>Footer</CardFooter>)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })
})

describe('Card composition', () => {
  it('renders a complete card', () => {
    render(
      <Card data-testid="card">
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
          <CardDescription>Card description text</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Card content goes here</p>
        </CardContent>
        <CardFooter>
          <button>Action</button>
        </CardFooter>
      </Card>
    )

    expect(screen.getByTestId('card')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Card Title' })).toBeInTheDocument()
    expect(screen.getByText('Card description text')).toBeInTheDocument()
    expect(screen.getByText('Card content goes here')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
  })
})
