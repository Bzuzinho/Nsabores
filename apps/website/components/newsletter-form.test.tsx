import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { NewsletterForm } from './newsletter-form';

describe('NewsletterForm', () => {
  it('validates the email and confirms a valid subscription', async () => {
    const user = userEvent.setup();
    render(<NewsletterForm />);

    const email = screen.getByRole('textbox', { name: 'Email' });
    const submit = screen.getByRole('button', { name: 'Subscrever' });

    await user.type(email, 'email-invalido');
    await user.click(submit);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Introduza um email válido.',
    );

    await user.clear(email);
    await user.type(email, 'cliente@example.com');
    await user.click(submit);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Subscrição registada. Obrigado!',
    );
  });
});
