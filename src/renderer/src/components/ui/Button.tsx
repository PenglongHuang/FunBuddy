import { motion } from 'motion/react'

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  variant: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
  icon?: React.ReactNode
  motionProps?: object
}

const variantStyle: Record<string, React.CSSProperties> = {
  primary: {
    padding: '4px 12px',
    borderRadius: 9999,
    fontSize: 12,
    fontWeight: 600,
    background: 'transparent',
    color: 'var(--accent-blue)',
    border: '1px solid rgba(10,132,255,0.40)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    transition: 'background 0.2s ease, color 0.2s ease, border-color 0.2s ease',
  },
  secondary: {
    padding: '4px 12px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
    background: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    border: 'none',
    cursor: 'pointer',
  },
  danger: {
    padding: '5px 16px',
    borderRadius: 9999,
    fontSize: 12,
    fontWeight: 600,
    background: 'var(--accent-pink)',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(255,55,95,0.20)',
  },
  ghost: {
    fontSize: 12,
    color: 'var(--text-tertiary)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 8,
    transition: 'color 0.15s ease, background 0.15s ease',
  },
}

const variantClass: Record<string, string> = {
  primary: 'hover-primary-lift',
  secondary: '',
  danger: '',
  ghost: 'hover-blue-lift',
}

export function Button({ variant, icon, motionProps, children, className = '', ...rest }: ButtonProps) {
  const style = variantStyle[variant]
  const cls = [variantClass[variant], className].filter(Boolean).join(' ')

  if (motionProps) {
    return (
      <motion.button className={cls} style={style} {...motionProps} {...(rest as React.ComponentProps<typeof motion.button>)}>
        {icon}
        {children}
      </motion.button>
    )
  }

  return (
    <button className={cls} style={style} {...rest}>
      {icon}
      {children}
    </button>
  )
}
