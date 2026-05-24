import { useState, useEffect } from 'react';
import { submitOrderFeedback, getOrderFeedback } from '../services/orderService';

interface FeedbackCardProps {
  orderId: string;
  isDelivered: boolean;
}

export default function FeedbackCard({ orderId, isDelivered }: FeedbackCardProps) {
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [existingFeedback, setExistingFeedback] = useState<{ rating: number; comment: string | null } | null>(null);

  useEffect(() => {
    if (!isDelivered) return;

    const loadExisting = async () => {
      try {
        const feedback = await getOrderFeedback(orderId);
        if (feedback) {
          setExistingFeedback({ rating: feedback.rating, comment: feedback.comment });
        }
      } catch {
        // Silently fail
      }
    };

    loadExisting();
  }, [orderId, isDelivered]);

  if (!isDelivered) {
    return (
      <div className="feedback-card-locked">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <p>A avaliação estará disponível após a entrega do seu pedido.</p>
      </div>
    );
  }

  if (existingFeedback) {
    return (
      <div className="feedback-existing">
        <div className="feedback-existing-stars">
          {[1, 2, 3, 4, 5].map(star => (
            <svg
              key={star}
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill={star <= existingFeedback.rating ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          ))}
        </div>
        {existingFeedback.comment && (
          <p>"{existingFeedback.comment}"</p>
        )}
        <p style={{ marginTop: '0.5rem', fontStyle: 'normal', fontWeight: 600, color: 'var(--color-text)' }}>
          Obrigado pela sua avaliação! 🍪
        </p>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="feedback-success">
        <div className="feedback-success-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h3>Obrigado! 🍪</h3>
        <p>Sua avaliação nos ajuda a melhorar sempre.</p>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (rating === 0) return;
    setIsSubmitting(true);

    try {
      await submitOrderFeedback(orderId, rating, comment);
      setIsSubmitted(true);
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="feedback-stars">
        {[1, 2, 3, 4, 5].map(star => (
          <svg
            key={star}
            className={`feedback-star ${star <= rating ? 'filled' : ''} ${star <= hoveredStar ? 'active' : ''}`}
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill={star <= (hoveredStar || rating) ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            onClick={() => setRating(star)}
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        ))}
      </div>

      <textarea
        className="feedback-textarea"
        placeholder="Conte como foi sua experiência... (opcional)"
        value={comment}
        onChange={e => setComment(e.target.value)}
        maxLength={500}
      />

      <button
        className="btn-feedback-submit"
        onClick={handleSubmit}
        disabled={rating === 0 || isSubmitting}
      >
        {isSubmitting ? (
          <>
            <div className="tracking-loading-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
            Enviando...
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            Enviar Avaliação
          </>
        )}
      </button>
    </div>
  );
}
