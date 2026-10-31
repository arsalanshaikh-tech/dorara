'use strict'

/**
 * Travel questionnaire seed — transcribed 1:1 from the frontend
 * (lib/travel/questionnaire.ts). Adding future modules is as simple as adding
 * more objects here with a different `vertical`.
 */

module.exports = [
  {
    vertical: 'travel',
    version: 1,
    title: 'Travel Planner',
    description:
      'Tell me about your trip so I can recommend destinations, costs, and a step-by-step plan.',
    submitLabel: 'Find best destinations',
    isPublished: true,
    steps: [
      {
        id: 'destination_preference',
        type: 'single_choice_or_text',
        label: 'Destination preference',
        help: "Name a city/country or choose 'Open to suggestions'.",
        options: [
          'Open to suggestions',
          'Specific country',
          'Specific city',
          'Region (e.g., Europe)',
        ],
        validation: { required: true },
        order: 0,
      },
      {
        id: 'budget',
        type: 'range_currency',
        label: 'Budget range',
        help: 'Enter your total trip budget (flights, accommodation, daily expenses).',
        fields: ['min', 'max', 'currency'],
        validation: { required: true, minValue: 50, maxValue: 1000000 },
        order: 1,
      },
      {
        id: 'dates',
        type: 'date_range',
        label: 'Duration of stay',
        help: 'Start and end dates, or an approximate duration in days (1–365).',
        validation: { required: false },
        order: 2,
      },
      {
        id: 'party',
        type: 'single_choice',
        label: 'Travel party',
        options: ['Solo', 'Couple', 'Family (kids)', 'Group of friends'],
        validation: { required: true },
        order: 3,
      },
      {
        id: 'age_group',
        type: 'single_choice',
        label: 'Age group',
        options: ['18-25', '26-35', '36-50', '50+'],
        validation: { required: false },
        order: 4,
      },
      {
        id: 'weather',
        type: 'multi_choice',
        label: 'Weather preference',
        options: ['Warm & sunny', 'Cool & mild', 'Cold & snowy', 'No preference'],
        validation: { required: false },
        order: 5,
      },
      {
        id: 'interest_type',
        type: 'multi_choice',
        label: 'Interest type',
        help: 'Pick everything that excites you — choose at least one.',
        options: [
          'Adventure',
          'Culture & history',
          'Luxury',
          'Nature & outdoors',
          'Food & nightlife',
          'Wellness',
        ],
        validation: { required: true, minSelected: 1 },
        order: 6,
      },
      {
        id: 'safety_importance',
        type: 'scale',
        label: 'How important is safety?',
        help: 'How much should safety influence your recommendations?',
        scale: { minLabel: 'Low', maxLabel: 'Critical', min: 1, max: 5 },
        validation: { required: true },
        order: 7,
      },
      {
        id: 'visa_requirements',
        type: 'single_choice',
        label: 'Visa requirements',
        options: [
          'I have a passport and visa-ready',
          'Need visa assistance',
          'Not sure',
        ],
        validation: { required: true },
        order: 8,
      },
      {
        id: 'food_language',
        type: 'multi_text',
        label: 'Food and language preferences',
        help: 'Any dietary restrictions or languages you prefer / want to avoid.',
        validation: { required: false },
        order: 9,
      },
      {
        id: 'extra_notes',
        type: 'long_text',
        label: 'Anything else we should know?',
        help: 'Optional — up to 1000 characters.',
        validation: { required: false, maxLength: 1000 },
        order: 10,
      },
    ],
  },
]
