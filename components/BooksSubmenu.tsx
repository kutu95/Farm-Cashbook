'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, BarChart3, FileText, DollarSign, Users, Zap } from 'lucide-react'

interface BooksSubmenuProps {
  variant?: 'header' | 'sidebar'
  isAdmin?: boolean
}

export default function BooksSubmenu({ variant = 'header', isAdmin = false }: BooksSubmenuProps) {
  const [isOpen, setIsOpen] = useState(false)

  const menuItems = [
    { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
    ...(isAdmin ? [
      { href: '/add-expense', label: 'Expense', icon: DollarSign },
      { href: '/add-payment', label: 'Payment', icon: DollarSign },
    ] : []),
    { href: '/statements', label: 'Statements', icon: FileText },
    { href: '/electricity-bills', label: 'Electricity Bills', icon: Zap },
    { href: '/electricity-usage-graph', label: 'Usage Graph', icon: BarChart3 },
  ]

  if (variant === 'sidebar') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div 
          onClick={() => setIsOpen(!isOpen)}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            cursor: 'pointer',
            padding: '0.5rem',
            borderRadius: '4px',
            backgroundColor: isOpen ? '#e5e7eb' : 'transparent'
          }}
        >
          <span style={{ fontWeight: 'bold', color: '#374151' }}>Books</span>
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
        {isOpen && (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '0.25rem',
            marginLeft: '1rem',
            borderLeft: '2px solid #d1d5db',
            paddingLeft: '0.5rem'
          }}>
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  textDecoration: 'none',
                  color: '#374151',
                  fontSize: '0.875rem'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                <item.icon size={14} />
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Header variant
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          background: 'none',
          border: 'none',
          color: '#2563eb',
          cursor: 'pointer',
          padding: '0.5rem',
          borderRadius: '4px',
          fontWeight: '500'
        }}
        onMouseEnter={() => setIsOpen(true)}
      >
        Books
        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '0',
            backgroundColor: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            minWidth: '180px',
            padding: '0.5rem 0'
          }}
          onMouseLeave={() => setIsOpen(false)}
        >
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                textDecoration: 'none',
                color: '#374151',
                fontSize: '0.875rem'
              }}
              onClick={() => setIsOpen(false)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <item.icon size={14} />
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
} 