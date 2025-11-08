import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Printer, X as XIcon, FileText, Receipt } from 'lucide-react';
import { formatINR } from '../../lib/currency';

interface InvoiceViewProps {
  invoiceId: string;
  onClose: () => void;
}

interface CompanyProfile {
  company_name: string;
  gst_number: string;
  pan_number: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  terms_conditions: string;
  logo_url: string;
}

type PrintFormat = 'full' | 'thermal';

export function InvoiceView({ invoiceId, onClose }: InvoiceViewProps) {
  const [loading, setLoading] = useState(true);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [printFormat, setPrintFormat] = useState<PrintFormat>('full');

  useEffect(() => {
    loadInvoiceData();
  }, [invoiceId]);

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        @page {
          size: A4;
          margin: 0;
        }
        body * {
          visibility: hidden;
        }
        #invoice-content, #invoice-content * {
          visibility: visible;
        }
        #invoice-content {
          position: absolute;
          left: 0;
          top: 0;
          width: ${printFormat === 'thermal' ? 'var(--print-width, 210mm)' : '100%'};
          padding: ${printFormat === 'thermal' ? '10px' : '0'};
          margin: 0;
        }
        .print\\:hidden {
          display: none !important;
        }
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        #invoice-content table {
          border: 2px solid #000 !important;
          border-collapse: collapse !important;
        }
        #invoice-content table th,
        #invoice-content table td {
          border: 1px solid #000 !important;
          border-style: solid !important;
          border-width: 1px !important;
          border-color: #000 !important;
          box-shadow: inset 0 0 0 1px #000 !important;
        }
        #invoice-content table thead th {
          border: 1px solid #000 !important;
          box-shadow: inset 0 0 0 1px #000 !important;
        }
        #invoice-content table tbody td {
          border: 1px solid #000 !important;
          box-shadow: inset 0 0 0 1px #000 !important;
        }
        ${printFormat === 'thermal' ? `
          #invoice-content {
            font-size: 11px !important;
          }
          #invoice-content h1 {
            font-size: 16px !important;
          }
          #invoice-content h2 {
            font-size: 14px !important;
          }
          #invoice-content h3 {
            font-size: 12px !important;
          }
          @page {
            size: 80mm auto;
            margin: 5mm;
          }
        ` : `
          @page {
            size: A4;
            margin: 0;
          }
        `}
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, [printFormat]);

  const loadInvoiceData = async () => {
    try {
      const invoiceRes = await supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(*),
          items:invoice_items(
            *,
            product:products(*)
          )
        `)
        .eq('id', invoiceId)
        .single();

      if (invoiceRes.error) throw invoiceRes.error;

      const profileRes = await supabase
        .from('company_profile')
        .select('*')
        .eq('user_id', invoiceRes.data.created_by)
        .maybeSingle();

      setInvoiceData(invoiceRes.data);
      setCompanyProfile(profileRes.data);
    } catch (error) {
      console.error('Error loading invoice:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const root = document.documentElement;
    if (printFormat === 'thermal') {
      root.style.setProperty('--print-width', '80mm');
    } else {
      root.style.setProperty('--print-width', '210mm');
    }
    window.print();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8">
          <div className="text-center">Loading invoice...</div>
        </div>
      </div>
    );
  }

  if (!invoiceData) {
    return null;
  }

  const { customer, items } = invoiceData;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full my-8">
        <div className="p-6 border-b-4 border-blue-600 print:hidden bg-gradient-to-r from-blue-50 to-slate-50">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">Invoice Preview</h2>
              <p className="text-sm text-slate-600">Choose your print format below</p>
            </div>
            <button
              onClick={onClose}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg transition shadow-lg hover:shadow-xl"
            >
              <XIcon className="w-4 h-4 flex-shrink-0" />
              <span>Close</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <button
              onClick={() => setPrintFormat('full')}
              className={`relative p-4 rounded-lg border-2 transition-all ${
                printFormat === 'full'
                  ? 'bg-blue-600 border-blue-600 text-white shadow-lg'
                  : 'bg-white border-slate-300 text-slate-700 hover:border-blue-400 hover:shadow-md'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-lg ${printFormat === 'full' ? 'bg-blue-700' : 'bg-blue-100'}`}>
                  <FileText className={`w-6 h-6 ${printFormat === 'full' ? 'text-white' : 'text-blue-600'}`} />
                </div>
                <div className="text-left">
                  <div className="text-lg font-bold mb-0.5">A4 Full Page</div>
                  <div className={`text-xs ${printFormat === 'full' ? 'text-blue-100' : 'text-slate-500'}`}>
                    Professional business invoice
                  </div>
                </div>
              </div>
              {printFormat === 'full' && (
                <div className="absolute top-3 right-3 bg-white text-blue-600 rounded-full p-1">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>

            <button
              onClick={() => setPrintFormat('thermal')}
              className={`relative p-4 rounded-lg border-2 transition-all ${
                printFormat === 'thermal'
                  ? 'bg-blue-600 border-blue-600 text-white shadow-lg'
                  : 'bg-white border-slate-300 text-slate-700 hover:border-blue-400 hover:shadow-md'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-lg ${printFormat === 'thermal' ? 'bg-blue-700' : 'bg-blue-100'}`}>
                  <Receipt className={`w-6 h-6 ${printFormat === 'thermal' ? 'text-white' : 'text-blue-600'}`} />
                </div>
                <div className="text-left">
                  <div className="text-lg font-bold mb-0.5">Thermal Receipt</div>
                  <div className={`text-xs ${printFormat === 'thermal' ? 'text-blue-100' : 'text-slate-500'}`}>
                    80mm POS receipt printer
                  </div>
                </div>
              </div>
              {printFormat === 'thermal' && (
                <div className="absolute top-3 right-3 bg-white text-blue-600 rounded-full p-1">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
          </div>

          <button
            onClick={handlePrint}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-lg transition shadow-lg hover:shadow-xl"
          >
            <Printer className="w-5 h-5" />
            Print Invoice - {printFormat === 'full' ? 'A4 Full Page' : 'Thermal 80mm'}
          </button>
        </div>

        <div className="overflow-auto max-h-[70vh] print:max-h-none print:overflow-visible">
          <div id="invoice-content" className="bg-white">
            {printFormat === 'full' ? (
              <div className="min-h-[297mm] bg-white">
                <div className="border-2 border-slate-300">
                  <div className="bg-white px-8 py-2">
                    <div className="flex justify-between items-start mb-1">
                      <div className="text-sm font-semibold text-slate-900">
                        <div className="flex items-start gap-1">
                          <span>MD.IRFAN:</span>
                          <svg className="w-3.5 h-3.5 text-slate-900 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          <span>7021125598</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                          </svg>
                          <span className="text-sm text-slate-900">{companyProfile?.whatsapp_number || '011775928011'}</span>
                        </div>
                      </div>

                      <div className="text-sm font-semibold text-slate-900 text-right">
                        <div className="flex items-start justify-end gap-1">
                          <span>MANSOOR:</span>
                          <svg className="w-3.5 h-3.5 text-slate-900 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          <span>9370041043</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-center mb-1 mt-8">
                      <h1 className="text-8xl font-bold tracking-wider text-slate-900 uppercase whitespace-nowrap translate-y-4" style={{ fontFamily: 'Georgia, serif', letterSpacing: '4px' }}>
                        {companyProfile?.company_name || 'HIJAB HOUSE'}
                      </h1>
                    </div>
                  </div>

                  <div className="px-20 mt-6">
                    <div className="text-center mb-2">
                      <p className="font-semibold tracking-wide text-slate-700" style={{ fontSize: '30px' }}>
                        Manufacturer & Wholesaler
                      </p>
                      <div className="flex items-center justify-center gap-1 text-slate-700 mt-0.5" style={{ fontSize: '30px' }}>
                        <svg className="w-7 h-7 flex-shrink-0 text-slate-700" fill="currentColor" viewBox="0 0 24 24" strokeWidth={0.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <p className="text-slate-700">
                          {companyProfile?.address_line1 ? companyProfile.address_line1 : '1st Floor, Miracle Mall, Teen Batti, Bhiwandi, Bhiwandi, Maharashtra 421302'}
                          {companyProfile?.city && `, ${companyProfile.city}, ${companyProfile.state} ${companyProfile.postal_code}`}
                        </p>
                      </div>
                    </div>
                    <table className="w-full border-collapse" style={{ border: '2px solid #000', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <td colSpan={3} className="p-3 text-lg" style={{ border: '1px solid #000', boxShadow: 'inset 0 0 0 1px #000' }}>
                            <span>M/s. :</span>
                            <span className="ml-2 font-semibold">{customer?.name}</span>
                          </td>
                          <td colSpan={2} className="p-3 text-lg" style={{ border: '1px solid #000', boxShadow: 'inset 0 0 0 1px #000' }}>
                            <span className="whitespace-nowrap">Bill No.: <span className="ml-2 font-bold text-lg">{invoiceData.invoice_number}</span></span>
                          </td>
                        </tr>
                        <tr>
                          <td colSpan={3} className="p-3 text-lg" style={{ border: '1px solid #000', boxShadow: 'inset 0 0 0 1px #000' }}>
                            <span>Address :</span>
                            <span className="ml-2">{customer?.address || ''}</span>
                          </td>
                          <td colSpan={2} className="p-3 text-lg" style={{ border: '1px solid #000', boxShadow: 'inset 0 0 0 1px #000' }}>
                            <span>Date:</span>
                            <span className="ml-2">
                              {new Date(invoiceData.created_at).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                              }).split('/').join(' / ')}
                            </span>
                          </td>
                        </tr>
                      <tr className="bg-slate-50">
                        <th className="py-1 px-2 text-base font-bold text-left w-12" style={{ border: '1px solid #000', boxShadow: 'inset 0 0 0 1px #000' }}>Sr. No.</th>
                        <th className="py-1 px-3 text-base font-bold text-center" style={{ border: '1px solid #000', boxShadow: 'inset 0 0 0 1px #000' }}>Particulars</th>
                        <th className="py-1 px-2 text-base font-bold text-center w-20" style={{ border: '1px solid #000', boxShadow: 'inset 0 0 0 1px #000' }}>Qnty</th>
                        <th className="py-1 px-2 text-base font-bold text-center w-20" style={{ border: '1px solid #000', boxShadow: 'inset 0 0 0 1px #000' }}>Rate</th>
                        <th className="py-1 px-2 text-base font-bold text-center w-24" style={{ border: '1px solid #000', boxShadow: 'inset 0 0 0 1px #000' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item: any, index: number) => (
                        <tr key={item.id}>
                          <td className="py-1 px-2 text-center text-base" style={{ border: '1px solid #000', boxShadow: 'inset 0 0 0 1px #000' }}>{index + 1}</td>
                          <td className="py-1 px-3 text-base" style={{ border: '1px solid #000', boxShadow: 'inset 0 0 0 1px #000' }}>{item.product?.description || item.product?.name}</td>
                          <td className="py-1 px-2 text-center text-base" style={{ border: '1px solid #000', boxShadow: 'inset 0 0 0 1px #000' }}>{item.quantity}</td>
                          <td className="py-1 px-2 text-right text-base" style={{ border: '1px solid #000', boxShadow: 'inset 0 0 0 1px #000' }}>{item.unit_price}</td>
                          <td className="py-1 px-2 text-right text-base" style={{ border: '1px solid #000', boxShadow: 'inset 0 0 0 1px #000' }}>{(item.quantity * item.unit_price).toFixed(2)}</td>
                        </tr>
                      ))}
                      {Array.from({ length: Math.max(0, 18 - items.length) }).map((_, i) => (
                        <tr key={`empty-${i}`}>
                          <td className="py-1 px-2 text-center text-base" style={{ border: '1px solid #000', boxShadow: 'inset 0 0 0 1px #000' }}>&nbsp;</td>
                          <td className="py-1 px-3 text-base" style={{ border: '1px solid #000', boxShadow: 'inset 0 0 0 1px #000' }}>&nbsp;</td>
                          <td className="py-1 px-2 text-base" style={{ border: '1px solid #000', boxShadow: 'inset 0 0 0 1px #000' }}>&nbsp;</td>
                          <td className="py-1 px-2 text-base" style={{ border: '1px solid #000', boxShadow: 'inset 0 0 0 1px #000' }}>&nbsp;</td>
                          <td className="py-1 px-2 text-base" style={{ border: '1px solid #000', boxShadow: 'inset 0 0 0 1px #000' }}>&nbsp;</td>
                        </tr>
                      ))}
                      <tr>
                        <td rowSpan={3} className="py-1 px-2" style={{ borderLeft: '1px solid #000', borderBottom: '1px solid #000', borderRight: 'none', borderTop: 'none' }}>&nbsp;</td>
                        <td rowSpan={3} className="py-1 px-2" style={{ borderLeft: 'none', borderBottom: '1px solid #000', borderRight: 'none', borderTop: 'none' }}>&nbsp;</td>
                        <td className="py-1 px-3 text-base font-semibold text-right" style={{ borderLeft: 'none', borderTop: '1px solid #000', borderRight: 'none', borderBottom: 'none' }}>Total</td>
                        <td className="py-1 px-2 text-base text-right" style={{ borderLeft: 'none', borderTop: '1px solid #000', borderRight: 'none', borderBottom: 'none' }}>&nbsp;</td>
                        <td className="py-1 px-2 text-base text-right font-semibold" style={{ borderLeft: 'none', borderTop: '1px solid #000', borderRight: '1px solid #000', borderBottom: 'none' }}>₹{invoiceData.total?.toFixed(2) || '0.00'}</td>
                      </tr>
                      <tr>
                        <td className="py-1 px-3 text-base font-semibold text-right" style={{ border: 'none' }}>Advance</td>
                        <td className="py-1 px-2 text-base text-right" style={{ border: 'none' }}>&nbsp;</td>
                        <td className="py-1 px-2 text-base text-right" style={{ borderLeft: 'none', borderTop: 'none', borderRight: '1px solid #000', borderBottom: 'none' }}>₹{invoiceData.amount_paid?.toFixed(2) || '0.00'}</td>
                      </tr>
                      <tr>
                        <td className="py-1 px-3 text-base font-semibold text-right" style={{ borderLeft: 'none', borderTop: 'none', borderRight: 'none', borderBottom: '1px solid #000' }}>Balance</td>
                        <td className="py-1 px-2 text-base text-right" style={{ borderLeft: 'none', borderTop: 'none', borderRight: 'none', borderBottom: '1px solid #000' }}>&nbsp;</td>
                        <td className="py-1 px-2 text-base text-right font-semibold" style={{ borderLeft: 'none', borderTop: 'none', borderRight: '1px solid #000', borderBottom: '1px solid #000' }}>₹{((invoiceData.total || 0) - (invoiceData.amount_paid || 0)).toFixed(2)}</td>
                      </tr>
                    </tbody>
                    </table>
                  </div>

                  <div className="px-6 py-3 border-t border-slate-300">
                    <div className="mb-3">
                      <p className="text-xs font-bold text-slate-900 mb-1">E & O.E</p>
                      <div className="text-xs text-slate-700 space-y-0.5">
                        <p>Note: 1) Our Responsibility Ceases When The Goods Have Left Our Godown.</p>
                        <p className="ml-12">2) All The Goods Are Checked Twice Before Dispatch.</p>
                        <p className="ml-12">3) Goods Once Sold Will Not Be Taken Back Or Exchange.</p>
                        <p className="ml-12">4) No Guarantee For Fancy Items.</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-end">
                      <div></div>
                      <div className="text-right">
                        <p className="text-xs italic text-slate-600 mb-8">For, {companyProfile?.company_name || 'Hijab House'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white px-6 py-3 text-center border-t border-slate-300">
                    <p className="text-xs text-slate-600 font-medium">Thank you for your business!</p>
                    {companyProfile?.website && (
                      <p className="text-xs text-slate-500 mt-1">{companyProfile.website}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 max-w-[80mm] mx-auto">
                <div className="text-center mb-4">
                  {companyProfile?.logo_url && (
                    <div className="flex justify-center mb-2">
                      <img
                        src={companyProfile.logo_url}
                        alt="Company Logo"
                        className="h-16 w-16 object-contain"
                      />
                    </div>
                  )}
                  <h1 className="text-2xl font-bold mb-1">
                    {companyProfile?.company_name || 'Company Name'}
                  </h1>
                  {companyProfile && (
                    <div className="text-xs text-slate-600">
                      {companyProfile.address_line1 && <p>{companyProfile.address_line1}</p>}
                      {companyProfile.phone && <p>Tel: {companyProfile.phone}</p>}
                      {companyProfile.gst_number && <p>GST: {companyProfile.gst_number}</p>}
                    </div>
                  )}
                </div>

                <div className="border-t border-b border-dashed border-slate-400 py-2 mb-2">
                  <div className="text-center font-bold text-lg">INVOICE</div>
                  <div className="text-xs">
                    <p>Invoice: #{invoiceData.invoice_number}</p>
                    <p>Date: {new Date(invoiceData.created_at).toLocaleDateString('en-IN')}</p>
                  </div>
                </div>

                <div className="text-xs mb-2">
                  <p className="font-bold mb-1">Customer:</p>
                  <p className="font-semibold">{customer?.name}</p>
                  {customer?.phone && <p>{customer.phone}</p>}
                </div>

                <table className="w-full text-xs mb-2">
                  <thead>
                    <tr className="border-b border-slate-400">
                      <th className="text-left py-1">Item</th>
                      <th className="text-center py-1">Qty</th>
                      <th className="text-right py-1">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item: any) => (
                      <tr key={item.id} className="border-b border-dashed border-slate-300">
                        <td className="py-1">{item.product?.description || item.product?.name}</td>
                        <td className="text-center py-1">{item.quantity}</td>
                        <td className="text-right py-1">{formatINR(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="text-xs space-y-1 mb-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatINR(invoiceData.subtotal)}</span>
                  </div>
                  {invoiceData.tax > 0 && (
                    <div className="flex justify-between">
                      <span>Tax:</span>
                      <span>{formatINR(invoiceData.tax)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm border-t border-slate-400 pt-1">
                    <span>TOTAL:</span>
                    <span>{formatINR(invoiceData.total)}</span>
                  </div>
                </div>

                <div className="text-center text-xs border-t border-dashed border-slate-400 pt-2">
                  <p className="font-medium">Thank you!</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
