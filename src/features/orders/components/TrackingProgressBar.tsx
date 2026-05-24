import type { OrderStatus } from '../types';

interface Step {
  status: OrderStatus;
  label: string;
  icon: React.ReactNode;
}

const STEPS: Step[] = [
  {
    status: 'PENDING',
    label: 'Pedido',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    status: 'PAID',
    label: 'Pago',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    ),
  },
  {
    status: 'PREPARING',
    label: 'Preparando',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
      </svg>
    ),
  },
  {
    status: 'OUT_FOR_DELIVERY',
    label: 'Entrega',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18.5" cy="17.5" r="3.5" />
        <circle cx="5.5" cy="17.5" r="3.5" />
        <polyline points="12 17.5 12 4 21 4 21 11" />
        <line x1="12" y1="8" x2="21" y2="8" />
        <polyline points="9 17.5 2 17.5 2 11 7 11" />
      </svg>
    ),
  },
  {
    status: 'DELIVERED',
    label: 'Entregue',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
];

const STATUS_ORDER: OrderStatus[] = ['PENDING', 'PAID', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'];

interface TrackingProgressBarProps {
  currentStatus: string;
}

export default function TrackingProgressBar({ currentStatus }: TrackingProgressBarProps) {
  const currentIndex = STATUS_ORDER.indexOf(currentStatus as OrderStatus);
  const fillPercent = currentIndex <= 0 ? 0 : (currentIndex / (STEPS.length - 1)) * 100;

  return (
    <div className="progress-bar-container">
      <div className="progress-bar-line">
        <div
          className="progress-bar-fill"
          style={{ width: `${fillPercent}%` }}
        />
      </div>

      {STEPS.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isActive = index === currentIndex;

        return (
          <div
            key={step.status}
            className={`progress-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}
          >
            <div className="progress-step-circle">
              {isCompleted ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                step.icon
              )}
            </div>
            <span className="progress-step-label">{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}
