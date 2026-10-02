/**
 * Preguntas de Jev para clasificar plantillas. Son lo que un humano revisa y ajusta:
 * cambiar el texto aquí cambia lo que Jev juzga. Recalibrar contra template_predictions.final_meta_category.
 */
export const JEV_TEMPLATE_QUESTIONS = {
  category: {
    type: 'choice',
    instructions:
      'Which WhatsApp Business template category does the message in `template.body` belong to, under Meta\'s category rules? A message that mixes transactional information with any promotion belongs to marketing.',
    criteria: {
      utility: {
        what: 'Information about a specific transaction, order, account, booking or request the recipient already made: confirmations, status updates, reminders, account or payment alerts.',
        not_for: 'Messages that also promote products, offer discounts, upsell, or invite a new purchase.',
        examples: ['Your order {{1}} has shipped and arrives on {{2}}.', 'Reminder: your appointment is tomorrow at {{1}}.'],
      },
      marketing: {
        what: 'Promotes products or services, offers discounts or deals, announces news, invites a purchase, re-engages customers, or mixes information with any promotion.',
        not_for: 'Purely transactional information with no promotional content at all.',
        examples: ['20% off this weekend only!', 'Your order shipped. Check out our new collection too.'],
      },
      authentication: {
        what: 'Delivers a one-time passcode or verification code so the recipient can verify their identity.',
        not_for: 'Anything other than delivering a verification code.',
        examples: ['{{1}} is your verification code.'],
      },
      none_of_the_above: {
        what: 'The text is not a business message to a customer, or is empty or unintelligible.',
        not_for: 'Any real business message, even a short one.',
        examples: ['asdf', ''],
      },
    },
  },
  promotional: {
    type: 'noul',
    instructions:
      'Does any part of `template.body` try to sell, promote, advertise a discount or offer, announce new products, or encourage a new purchase?',
    criteria: {
      true: 'At least one phrase promotes, sells, offers a discount, or invites buying something new, even inside an otherwise transactional message.',
      false: 'Every sentence only informs about something the recipient already requested, bought, booked, or owns.',
    },
  },
} as const
