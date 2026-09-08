export function scrollToSection(sectionId: string) {
  const normalizedId = sectionId.replace('#', '');
  const element = document.getElementById(normalizedId);

  if (!element) {
    return;
  }

  element.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });

  if (window.location.hash !== `#${normalizedId}`) {
    window.history.replaceState(null, '', `#${normalizedId}`);
  }
}

export function handleSectionLinkClick(event: React.MouseEvent<HTMLElement>, sectionId: string, onAfterClick?: () => void) {
  event.preventDefault();
  onAfterClick?.();
  scrollToSection(sectionId);
}
