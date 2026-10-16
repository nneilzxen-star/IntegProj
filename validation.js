const FIELD_RULES = {
  name: { id: 'name-error', message: 'Please enter your full name.', test: (value) => value.trim().length >= 2 },
  email: { id: 'email-error', message: 'Enter a valid email address.', test: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()) },
  phone: { id: 'phone-error', message: 'Enter a valid phone number.', test: (value) => /^\+?[0-9][0-9\s().-]{6,18}[0-9]$/.test(value.trim()) },
  zip: { id: 'zip-error', message: 'Enter a valid ZIP or postal code.', test: (value) => /^[A-Za-z0-9][A-Za-z0-9 -]{2,9}$/.test(value.trim()) },
  address: { id: 'address-error', message: 'Please enter a complete delivery address.', test: (value) => value.trim().length >= 8 },
  payment: { id: 'payment-error', message: 'Choose a payment method.', test: (value) => Boolean(value) },
  cardNumber: { id: 'card-error', message: 'Enter a demo card number with 13–19 digits.', test: (value) => /^\d{13,19}$/.test(value.replace(/\s/g, '')) },
  terms: { id: 'terms-error', message: 'Please agree to the demo order terms.', test: (value, field) => field.checked }
};

function readFieldValue(form, name) {
  return form.elements.namedItem(name)?.value ?? '';
}

/** Validate one checkout field with native and inline error feedback. */
export const validateField = (form, name) => {
  const field = form.elements.namedItem(name);
  const rule = FIELD_RULES[name];
  if (!field || !rule) return false;
  if (name === 'cardNumber' && form.elements.payment?.value !== 'card') {
    field.setCustomValidity('');
    field.classList.remove('is-invalid', 'is-valid');
    document.getElementById(rule.id).textContent = '';
    return true;
  }

  const valid = rule.test(readFieldValue(form, name), field);
  const message = valid ? '' : rule.message;
  field.setCustomValidity(message);
  const errorElement = document.getElementById(rule.id);
  errorElement.textContent = message;
  field.classList.toggle('is-invalid', !valid);
  field.classList.toggle('is-valid', valid);
  field.setAttribute('aria-invalid', String(!valid));
  field.setAttribute('aria-describedby', rule.id);
  return valid;
};

/** Validate all required fields and return whether the form can submit. */
export const validateCheckoutForm = (form) => Object.keys(FIELD_RULES)
  .map((name) => validateField(form, name))
  .every(Boolean) && form.checkValidity();

/** Attach live field validation and disable checkout until all checks pass. */
export const setupCheckoutValidation = (form, submitButton) => {
  const updateValidity = () => {
    submitButton.disabled = !validateCheckoutForm(form);
  };
  form.addEventListener('input', updateValidity);
  form.addEventListener('change', updateValidity);
  return updateValidity;
};

/** Validate a newsletter form using the browser Constraint Validation API. */
export const validateNewsletterForm = (form) => {
  const email = form.elements.email;
  const errorElement = document.getElementById('newsletter-error');
  const status = document.getElementById('newsletter-status');
  email.setCustomValidity('');
  const valid = form.checkValidity();
  email.setCustomValidity(valid ? '' : 'Enter a valid email address to join.');
  errorElement.textContent = valid ? '' : email.validationMessage;
  email.classList.toggle('is-invalid', !valid);
  email.classList.toggle('is-valid', valid);
  status.textContent = '';
  return valid;
};
