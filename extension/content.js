/* Swipe Toolkit — Content Script (injected into every page) */

// Track the last non-empty selection so it survives popup click deselection
let lastSelection = '';

document.addEventListener('mouseup', () => {
  const text = window.getSelection()?.toString()?.trim() || '';
  if (text) lastSelection = text;
});

document.addEventListener('keyup', () => {
  const text = window.getSelection()?.toString()?.trim() || '';
  if (text) lastSelection = text;
});

// Respond to selection requests from the popup / background
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_SELECTION') {
    const current = window.getSelection()?.toString()?.trim() || '';
    sendResponse({ text: current || lastSelection });
  }

  if (message.type === 'GET_UPWORK_JOB') {
    const data = extractUpworkJob();
    sendResponse(data);
  }
});

/** Extract job description from an Upwork job posting page */
function extractUpworkJob() {
  const url = window.location.href;
  const isUpwork = url.includes('upwork.com');
  if (!isUpwork) return { isUpwork: false, title: '', description: '', budget: '', skills: '' };

  // Job title
  const titleEl = document.querySelector('h4.m-0') ||
    document.querySelector('[data-test="job-title"]') ||
    document.querySelector('.job-details-header h4') ||
    document.querySelector('header h4');
  const title = titleEl?.textContent?.trim() || '';

  // Job description
  const descEl = document.querySelector('[data-test="description"]') ||
    document.querySelector('.job-description') ||
    document.querySelector('[data-cy="description"]') ||
    document.querySelector('.break.mt-2');
  const description = descEl?.textContent?.trim() || '';

  // Budget/rate
  const budgetEl = document.querySelector('[data-test="budget"]') ||
    document.querySelector('[data-test="hourly-rate"]') ||
    document.querySelector('.budget');
  const budget = budgetEl?.textContent?.trim() || '';

  // Skills
  const skillEls = document.querySelectorAll('[data-test="skill"] .air3-badge, .skills-list .skill, .up-skill-badge');
  const skills = Array.from(skillEls).map(el => el.textContent.trim()).filter(Boolean).join(', ');

  return { isUpwork: true, title, description, budget, skills };
}
