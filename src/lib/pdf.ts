import type { NormalizedBooking } from './bookings';
import { photoLabel, statusLabel } from './bookings';
import { STUDIO } from '../content/site';

// jsPDF (~420 KB) is loaded only when someone actually downloads a PDF.
const loadPdf = async () => {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  return { jsPDF, autoTable };
};

const php = (value: number) => `PHP ${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const addHeader = (doc: any, title: string, subtitle?: string) => {
  doc.setFontSize(20);
  doc.setTextColor(230, 57, 70);
  doc.text(STUDIO.name, 14, 22);
  doc.setFontSize(15);
  doc.setTextColor(0, 0, 0);
  doc.text(title, 14, 31);
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(subtitle || `Generated ${new Date().toLocaleString()}`, 14, 38);
  doc.setTextColor(0, 0, 0);
};

const addPageNumbers = (doc: any) => {
  const pageCount = doc.internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text(`Page ${page} of ${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
  }
};

export async function downloadBookingReceipt(booking: NormalizedBooking) {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF();
  addHeader(doc, 'Official Booking Receipt', `Receipt No: ${booking.receiptNumber}   ·   Issued: ${new Date(booking.receiptIssuedAt || Date.now()).toLocaleString()}`);

  autoTable(doc, {
    startY: 46,
    head: [['Field', 'Details']],
    body: [
      ['Customer', booking.fullName],
      ['Email', booking.email || 'N/A'],
      ['Service', booking.service],
      ['Date', booking.dateDisplay],
      ['Time', booking.time],
      ['Location', booking.location || 'N/A'],
      ['Status', statusLabel(booking.status).toUpperCase()],
      ['Photo Delivery', booking.photoStatus ? photoLabel(booking.photoStatus) : 'N/A'],
      ['Google Drive', booking.driveLink || 'Not provided yet'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [230, 57, 70], textColor: 255, fontStyle: 'bold' },
    bodyStyles: { fontSize: 10 },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 10,
    head: [['Computation', 'Amount']],
    body: [
      [`Service (${booking.durationHours || 0} hr${booking.durationHours === 1 ? '' : 's'} × ${php(booking.serviceRate)})`, php(booking.baseSubtotal)],
      ['Transportation', php(booking.transportationFee)],
      ['Confirmed Total', php(booking.totalAmount)],
      ['Downpayment Received', php(booking.downpaymentAmount)],
      ['Balance Due on Shoot Day', php(booking.remainingBalance)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold' },
    bodyStyles: { fontSize: 10 },
    columnStyles: { 1: { halign: 'right' } },
  });

  doc.save(`${booking.receiptNumber}.pdf`);
}

export async function exportBookingsPdf(bookings: NormalizedBooking[]) {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ orientation: 'landscape' });
  addHeader(doc, 'Bookings Report');
  const count = (status: string) => bookings.filter((booking) => booking.status === status).length;
  doc.setFontSize(10);
  doc.text(`Total: ${bookings.length}   Pending: ${count('pending')}   Confirmed: ${count('confirmed')}   Completed: ${count('completed')}   Cancelled: ${count('cancelled')}`, 14, 46);

  autoTable(doc, {
    startY: 52,
    head: [['Ref', 'Service', 'Date', 'Time', 'Customer', 'Email', 'Location', 'Amount', 'Status']],
    body: bookings.map((booking) => [
      booking.reference,
      booking.service,
      booking.date,
      booking.time,
      booking.fullName,
      booking.email,
      booking.location,
      php(booking.totalAmount),
      statusLabel(booking.status),
    ]),
    theme: 'grid',
    headStyles: { fillColor: [230, 57, 70], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: { 7: { halign: 'right' } },
  });
  addPageNumbers(doc);
  doc.save(`Tutok-Pitik-Bookings-${new Date().toISOString().split('T')[0]}.pdf`);
}

export async function exportUsersPdf(users: any[]) {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF();
  addHeader(doc, 'Users Report');
  const count = (role: string) => users.filter((user) => user.role === role).length;
  doc.setFontSize(10);
  doc.text(`Total: ${users.length}   Super Admins: ${count('superadmin')}   Admins: ${count('admin')}   Staff: ${count('staff')}   Customers: ${count('customer')}`, 14, 46);

  autoTable(doc, {
    startY: 52,
    head: [['Full Name', 'Email', 'Username', 'Role', 'Status', 'Joined']],
    body: users.map((user) => [
      user.fullName || 'N/A',
      user.email || 'N/A',
      user.username || '—',
      String(user.role || 'customer').toUpperCase(),
      user.status || 'active',
      new Date(user.joinDate || user.created_at || Date.now()).toLocaleDateString(),
    ]),
    theme: 'grid',
    headStyles: { fillColor: [230, 57, 70], textColor: 255, fontStyle: 'bold', fontSize: 10 },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });
  addPageNumbers(doc);
  doc.save(`Tutok-Pitik-Users-${new Date().toISOString().split('T')[0]}.pdf`);
}
