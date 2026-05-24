import type { StatusHistoryEntry } from '../services/orderService';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pedido recebido',
  PAID: 'Pagamento confirmado',
  PREPARING: 'Em preparação',
  OUT_FOR_DELIVERY: 'Saiu para entrega',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
};

interface TrackingTimelineProps {
  history: StatusHistoryEntry[];
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  if (isToday) return 'Hoje';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function TrackingTimeline({ history }: TrackingTimelineProps) {
  if (!history || history.length === 0) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
        Nenhum registro de acompanhamento ainda.
      </div>
    );
  }

  return (
    <div className="timeline-container">
      <div className="timeline-line" />

      {history.map((entry, index) => {
        const isLatest = index === history.length - 1;

        return (
          <div
            key={entry.id}
            className={`timeline-item ${isLatest ? 'latest' : 'active'}`}
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="timeline-dot" />
            <div className="timeline-time">
              {formatDate(entry.created_at)} • {formatTime(entry.created_at)}
            </div>
            <div className="timeline-status">
              {STATUS_LABELS[entry.status] || entry.status}
            </div>
            {entry.notes && (
              <div className="timeline-notes">{entry.notes}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
