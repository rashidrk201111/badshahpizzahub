import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Search, Trash2, Edit2, Printer, Clock, CheckCircle, XCircle, Utensils, Truck, ShoppingBag, Eye } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { formatINR } from '../../lib/currency';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category_id: string;
}

interface KOTItem {
  menu_item_id: string;
  menu_item_name?: string;
  quantity: number;
  unit_price: number;
  notes?: string;
}

interface KOT {
  id: string;
  kot_number: string;
  order_type: 'dine_in' | 'delivery' | 'take_away';
  table_number?: string;
  customer_name?: string;
  customer_phone?: string;
  delivery_platform?: string;
  delivery_order_id?: string;
  status: string;
  notes?: string;
  created_at: string;
  invoice_id?: string;
}

export function KOT() {
  const { user } = useAuth();
  const [kots, setKots] = useState<KOT[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingKOT, setEditingKOT] = useState<KOT | null>(null);
  const [selectedItems, setSelectedItems] = useState<KOTItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>('all');

  const [formData, setFormData] = useState({
    order_type: 'dine_in' as 'dine_in' | 'delivery' | 'take_away',
    table_number: '',
    customer_name: '',
    customer_phone: '',
    delivery_platform: '',
    delivery_order_id: '',
    notes: '',
  });

  useEffect(() => {
    loadKOTs();
    loadMenuItems();
  }, []);

  const loadKOTs = async () => {
    try {
      const { data, error } = await supabase
        .from('kots')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setKots(data || []);
    } catch (error) {
      console.error('Error loading KOTs:', error);
      alert('Error loading KOTs');
    } finally {
      setLoading(false);
    }
  };

  const loadMenuItems = async () => {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('is_available', true)
        .order('name');

      if (error) throw error;
      setMenuItems(data || []);
    } catch (error) {
      console.error('Error loading menu items:', error);
    }
  };

  const handleAddItem = (menuItem: MenuItem) => {
    const existingItem = selectedItems.find(item => item.menu_item_id === menuItem.id);

    if (existingItem) {
      setSelectedItems(selectedItems.map(item =>
        item.menu_item_id === menuItem.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setSelectedItems([...selectedItems, {
        menu_item_id: menuItem.id,
        menu_item_name: menuItem.name,
        quantity: 1,
        unit_price: menuItem.price,
      }]);
    }
  };

  const handleRemoveItem = (menuItemId: string) => {
    setSelectedItems(selectedItems.filter(item => item.menu_item_id !== menuItemId));
  };

  const handleUpdateQuantity = (menuItemId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveItem(menuItemId);
      return;
    }
    setSelectedItems(selectedItems.map(item =>
      item.menu_item_id === menuItemId
        ? { ...item, quantity }
        : item
    ));
  };

  const calculateTotal = () => {
    return selectedItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedItems.length === 0) {
      alert('Please add at least one item');
      return;
    }

    if (formData.order_type === 'dine_in' && !formData.table_number) {
      alert('Please enter table number for dine-in orders');
      return;
    }

    try {
      const kotData: any = {
        order_type: formData.order_type,
        customer_name: formData.customer_name || null,
        customer_phone: formData.customer_phone || null,
        notes: formData.notes || null,
        user_id: user?.id,
        status: 'pending',
      };

      if (formData.order_type === 'dine_in') {
        kotData.table_number = formData.table_number;
      } else if (formData.order_type === 'delivery') {
        kotData.delivery_platform = formData.delivery_platform || null;
        kotData.delivery_order_id = formData.delivery_order_id || null;
      }

      if (editingKOT) {
        const { error: kotError } = await supabase
          .from('kots')
          .update(kotData)
          .eq('id', editingKOT.id);

        if (kotError) throw kotError;

        await supabase.from('kot_items').delete().eq('kot_id', editingKOT.id);

        const kotItems = selectedItems.map(item => ({
          kot_id: editingKOT.id,
          menu_item_id: item.menu_item_id,
          menu_item_name: item.menu_item_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          notes: item.notes || null,
        }));

        const { error: itemsError } = await supabase.from('kot_items').insert(kotItems);
        if (itemsError) throw itemsError;

        if (editingKOT.invoice_id) {
          await updateInvoice(editingKOT.invoice_id);
        }
      } else {
        const kotNumber = await generateKOTNumber();
        kotData.kot_number = kotNumber;

        const { data: kot, error: kotError } = await supabase
          .from('kots')
          .insert(kotData)
          .select()
          .single();

        if (kotError) throw kotError;

        const kotItems = selectedItems.map(item => ({
          kot_id: kot.id,
          menu_item_id: item.menu_item_id,
          menu_item_name: item.menu_item_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          notes: item.notes || null,
        }));

        const { error: itemsError } = await supabase.from('kot_items').insert(kotItems);
        if (itemsError) throw itemsError;

        await createInvoiceForKOT(kot);
      }

      resetForm();
      loadKOTs();
      setShowModal(false);
    } catch (error) {
      console.error('Error saving KOT:', error);
      alert('Error saving KOT: ' + (error as Error).message);
    }
  };

  const generateKOTNumber = async (): Promise<string> => {
    const { data, error } = await supabase.rpc('generate_kot_number');
    if (error) throw error;
    return data;
  };

  const createInvoiceForKOT = async (kot: any) => {
    try {
      const subtotal = calculateTotal();
      const taxRate = 0.05;
      const tax = subtotal * taxRate;
      const total = subtotal + tax;

      const invoiceData = {
        customer_id: null,
        customer_name: kot.customer_name || 'Walk-in Customer',
        customer_phone: kot.customer_phone || null,
        subtotal,
        tax,
        total,
        status: 'draft',
        payment_status: 'unpaid',
        user_id: user?.id,
      };

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert(invoiceData)
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      const invoiceItems = selectedItems.map(item => ({
        invoice_id: invoice.id,
        menu_item_id: item.menu_item_id,
        menu_item_name: item.menu_item_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: 5,
        tax_amount: item.quantity * item.unit_price * 0.05,
        total: item.quantity * item.unit_price * 1.05,
      }));

      const { error: itemsError } = await supabase.from('invoice_items').insert(invoiceItems);
      if (itemsError) throw itemsError;

      await supabase.from('kots').update({ invoice_id: invoice.id }).eq('id', kot.id);
    } catch (error) {
      console.error('Error creating invoice:', error);
    }
  };

  const updateInvoice = async (invoiceId: string) => {
    try {
      const subtotal = calculateTotal();
      const taxRate = 0.05;
      const tax = subtotal * taxRate;
      const total = subtotal + tax;

      await supabase
        .from('invoices')
        .update({ subtotal, tax, total })
        .eq('id', invoiceId);

      await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId);

      const invoiceItems = selectedItems.map(item => ({
        invoice_id: invoiceId,
        menu_item_id: item.menu_item_id,
        menu_item_name: item.menu_item_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: 5,
        tax_amount: item.quantity * item.unit_price * 0.05,
        total: item.quantity * item.unit_price * 1.05,
      }));

      await supabase.from('invoice_items').insert(invoiceItems);
    } catch (error) {
      console.error('Error updating invoice:', error);
    }
  };

  const handleEdit = async (kot: KOT) => {
    try {
      const { data: items, error } = await supabase
        .from('kot_items')
        .select('*')
        .eq('kot_id', kot.id);

      if (error) throw error;

      setEditingKOT(kot);
      setFormData({
        order_type: kot.order_type,
        table_number: kot.table_number || '',
        customer_name: kot.customer_name || '',
        customer_phone: kot.customer_phone || '',
        delivery_platform: kot.delivery_platform || '',
        delivery_order_id: kot.delivery_order_id || '',
        notes: kot.notes || '',
      });
      setSelectedItems(items || []);
      setShowModal(true);
    } catch (error) {
      console.error('Error loading KOT:', error);
      alert('Error loading KOT');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this KOT?')) return;

    try {
      const { error } = await supabase.from('kots').delete().eq('id', id);
      if (error) throw error;
      loadKOTs();
    } catch (error) {
      console.error('Error deleting KOT:', error);
      alert('Error deleting KOT');
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('kots')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      loadKOTs();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error updating status');
    }
  };

  const handlePrintKOT = async (kot: KOT) => {
    try {
      const { data: items, error } = await supabase
        .from('kot_items')
        .select('*')
        .eq('kot_id', kot.id);

      if (error) throw error;

      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      const orderTypeIcons = {
        dine_in: '🍽️',
        delivery: '🚚',
        take_away: '🛍️'
      };

      const orderTypeLabels = {
        dine_in: 'DINE IN',
        delivery: 'DELIVERY',
        take_away: 'TAKE AWAY'
      };

      const orderTypeColors = {
        dine_in: '#10b981',
        delivery: '#f59e0b',
        take_away: '#3b82f6'
      };

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>KOT - ${kot.kot_number}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Courier New', monospace;
              width: 80mm;
              padding: 5mm;
              font-size: 12px;
              line-height: 1.4;
            }
            .header {
              text-align: center;
              margin-bottom: 10px;
              padding-bottom: 10px;
              border-bottom: 2px solid #000;
            }
            .header h1 {
              font-size: 20px;
              margin-bottom: 5px;
            }
            .order-type-badge {
              display: inline-block;
              padding: 8px 16px;
              margin: 10px 0;
              border-radius: 4px;
              font-weight: bold;
              font-size: 16px;
              color: white;
              background-color: ${orderTypeColors[kot.order_type]};
            }
            .info {
              margin-bottom: 10px;
              padding-bottom: 10px;
              border-bottom: 1px dashed #000;
              font-size: 11px;
            }
            .info div {
              margin-bottom: 3px;
            }
            .info-label {
              font-weight: bold;
              display: inline-block;
              width: 80px;
            }
            .items {
              margin-bottom: 10px;
              padding-bottom: 10px;
              border-bottom: 1px dashed #000;
            }
            .item {
              margin-bottom: 10px;
              padding: 8px;
              background: #f9f9f9;
              border-left: 3px solid #000;
            }
            .item-name {
              font-weight: bold;
              font-size: 13px;
              margin-bottom: 3px;
            }
            .item-qty {
              font-size: 14px;
              font-weight: bold;
            }
            .item-notes {
              font-style: italic;
              font-size: 11px;
              margin-top: 3px;
              color: #666;
            }
            .footer {
              text-align: center;
              margin-top: 15px;
              padding-top: 10px;
              border-top: 1px dashed #000;
              font-size: 11px;
            }
            .timestamp {
              text-align: center;
              font-size: 10px;
              margin-top: 10px;
            }
            @media print {
              body {
                width: 80mm;
                margin: 0;
                padding: 5mm;
              }
              @page {
                size: 80mm auto;
                margin: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>KITCHEN ORDER TICKET</h1>
            <div>${kot.kot_number}</div>
            <div class="order-type-badge">
              ${orderTypeIcons[kot.order_type]} ${orderTypeLabels[kot.order_type]}
            </div>
          </div>

          <div class="info">
            ${kot.order_type === 'dine_in' ? `<div><span class="info-label">Table:</span> ${kot.table_number}</div>` : ''}
            ${kot.customer_name ? `<div><span class="info-label">Customer:</span> ${kot.customer_name}</div>` : ''}
            ${kot.customer_phone ? `<div><span class="info-label">Phone:</span> ${kot.customer_phone}</div>` : ''}
            ${kot.delivery_platform ? `<div><span class="info-label">Platform:</span> ${kot.delivery_platform}</div>` : ''}
            ${kot.delivery_order_id ? `<div><span class="info-label">Order ID:</span> ${kot.delivery_order_id}</div>` : ''}
            ${kot.notes ? `<div><span class="info-label">Notes:</span> ${kot.notes}</div>` : ''}
          </div>

          <div class="items">
            ${items.map((item: any) => `
              <div class="item">
                <div class="item-name">${item.menu_item_name}</div>
                <div class="item-qty">Quantity: ${item.quantity}</div>
                ${item.notes ? `<div class="item-notes">Note: ${item.notes}</div>` : ''}
              </div>
            `).join('')}
          </div>

          <div class="footer">
            <div style="font-weight: bold;">Total Items: ${items.reduce((sum: number, item: any) => sum + parseFloat(item.quantity), 0)}</div>
          </div>

          <div class="timestamp">
            Printed: ${new Date().toLocaleString('en-IN')}
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
        </html>
      `);

      printWindow.document.close();
    } catch (error) {
      console.error('Error printing KOT:', error);
      alert('Error printing KOT');
    }
  };

  const handleViewReceipt = async (kot: KOT) => {
    try {
      const { data: items, error: itemsError } = await supabase
        .from('kot_items')
        .select('*')
        .eq('kot_id', kot.id);

      if (itemsError) throw itemsError;

      const { data: companyProfile, error: profileError } = await supabase
        .from('company_profile')
        .select('*')
        .maybeSingle();

      if (profileError) throw profileError;

      const subtotal = items.reduce((sum: number, item: any) =>
        sum + (parseFloat(item.quantity) * parseFloat(item.unit_price)), 0
      );
      const taxRate = 0.05;
      const tax = subtotal * taxRate;
      const total = subtotal + tax;

      const orderTypeIcons = {
        dine_in: '🍽️',
        delivery: '🚚',
        take_away: '🛍️'
      };

      const orderTypeLabels = {
        dine_in: 'DINE IN',
        delivery: 'DELIVERY',
        take_away: 'TAKE AWAY'
      };

      const orderTypeColors = {
        dine_in: '#10b981',
        delivery: '#f59e0b',
        take_away: '#3b82f6'
      };

      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Order Receipt - ${kot.kot_number}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Courier New', monospace;
              width: 80mm;
              padding: 5mm;
              font-size: 12px;
              line-height: 1.4;
            }
            .header {
              text-align: center;
              margin-bottom: 10px;
              padding-bottom: 10px;
              border-bottom: 2px solid #000;
            }
            .header h1 {
              font-size: 18px;
              margin-bottom: 5px;
            }
            .company-info {
              text-align: center;
              font-size: 10px;
              margin-bottom: 5px;
            }
            .order-type-badge {
              display: inline-block;
              padding: 6px 12px;
              margin: 8px 0;
              border-radius: 4px;
              font-weight: bold;
              font-size: 14px;
              color: white;
              background-color: ${orderTypeColors[kot.order_type]};
            }
            .info {
              margin-bottom: 10px;
              padding-bottom: 10px;
              border-bottom: 1px dashed #000;
              font-size: 11px;
            }
            .info div {
              margin-bottom: 3px;
            }
            .info-label {
              font-weight: bold;
              display: inline-block;
              width: 80px;
            }
            .items-table {
              width: 100%;
              margin-bottom: 10px;
              border-collapse: collapse;
            }
            .items-table th {
              text-align: left;
              padding: 5px 0;
              border-bottom: 1px solid #000;
              font-size: 11px;
            }
            .items-table td {
              padding: 5px 0;
              border-bottom: 1px dashed #ddd;
              font-size: 11px;
            }
            .items-table .item-name {
              font-weight: bold;
            }
            .items-table .qty {
              text-align: center;
              width: 30px;
            }
            .items-table .price {
              text-align: right;
              width: 60px;
            }
            .totals {
              margin-top: 10px;
              padding-top: 10px;
              border-top: 1px solid #000;
            }
            .totals div {
              display: flex;
              justify-content: space-between;
              margin-bottom: 5px;
              font-size: 11px;
            }
            .totals .grand-total {
              font-size: 14px;
              font-weight: bold;
              padding-top: 5px;
              border-top: 2px solid #000;
            }
            .footer {
              text-align: center;
              margin-top: 15px;
              padding-top: 10px;
              border-top: 1px dashed #000;
              font-size: 11px;
            }
            .footer .thank-you {
              font-weight: bold;
              font-size: 14px;
              margin-bottom: 5px;
            }
            .timestamp {
              text-align: center;
              font-size: 10px;
              margin-top: 10px;
              color: #666;
            }
            @media print {
              body {
                width: 80mm;
                margin: 0;
                padding: 5mm;
              }
              @page {
                size: 80mm auto;
                margin: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${companyProfile?.company_name || 'Restaurant'}</h1>
            ${companyProfile ? `
              <div class="company-info">
                ${companyProfile.address_line1 ? `<div>${companyProfile.address_line1}</div>` : ''}
                ${companyProfile.phone ? `<div>Tel: ${companyProfile.phone}</div>` : ''}
                ${companyProfile.gst_number ? `<div>GST: ${companyProfile.gst_number}</div>` : ''}
              </div>
            ` : ''}
            <div style="font-size: 16px; font-weight: bold; margin-top: 8px;">ORDER RECEIPT</div>
            <div class="order-type-badge">
              ${orderTypeIcons[kot.order_type]} ${orderTypeLabels[kot.order_type]}
            </div>
          </div>

          <div class="info">
            <div><span class="info-label">Order:</span> ${kot.kot_number}</div>
            <div><span class="info-label">Date:</span> ${new Date(kot.created_at).toLocaleDateString('en-IN')}</div>
            <div><span class="info-label">Time:</span> ${new Date(kot.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
            ${kot.order_type === 'dine_in' ? `<div><span class="info-label">Table:</span> ${kot.table_number}</div>` : ''}
            ${kot.customer_name ? `<div><span class="info-label">Customer:</span> ${kot.customer_name}</div>` : ''}
            ${kot.customer_phone ? `<div><span class="info-label">Phone:</span> ${kot.customer_phone}</div>` : ''}
            ${kot.delivery_platform ? `<div><span class="info-label">Platform:</span> ${kot.delivery_platform}</div>` : ''}
            ${kot.delivery_order_id ? `<div><span class="info-label">Order ID:</span> ${kot.delivery_order_id}</div>` : ''}
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th class="qty">Qty</th>
                <th class="price">Price</th>
                <th class="price">Total</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item: any) => `
                <tr>
                  <td class="item-name">${item.menu_item_name}</td>
                  <td class="qty">${item.quantity}</td>
                  <td class="price">₹${parseFloat(item.unit_price).toFixed(2)}</td>
                  <td class="price">₹${(parseFloat(item.quantity) * parseFloat(item.unit_price)).toFixed(2)}</td>
                </tr>
                ${item.notes ? `
                  <tr>
                    <td colspan="4" style="font-size: 10px; font-style: italic; padding-left: 10px;">Note: ${item.notes}</td>
                  </tr>
                ` : ''}
              `).join('')}
            </tbody>
          </table>

          <div class="totals">
            <div>
              <span>Subtotal:</span>
              <span>₹${subtotal.toFixed(2)}</span>
            </div>
            <div>
              <span>Tax (5%):</span>
              <span>₹${tax.toFixed(2)}</span>
            </div>
            <div class="grand-total">
              <span>TOTAL:</span>
              <span>₹${total.toFixed(2)}</span>
            </div>
          </div>

          <div class="footer">
            <div class="thank-you">Thank You!</div>
            <div>Please visit again</div>
            ${companyProfile?.website ? `<div>${companyProfile.website}</div>` : ''}
          </div>

          <div class="timestamp">
            Printed: ${new Date().toLocaleString('en-IN')}
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
        </html>
      `);

      printWindow.document.close();
    } catch (error) {
      console.error('Error viewing receipt:', error);
      alert('Error viewing receipt');
    }
  };

  const resetForm = () => {
    setFormData({
      order_type: 'dine_in',
      table_number: '',
      customer_name: '',
      customer_phone: '',
      delivery_platform: '',
      delivery_order_id: '',
      notes: '',
    });
    setSelectedItems([]);
    setEditingKOT(null);
  };

  const getStatusBadge = (status: string) => {
    const badges: { [key: string]: { label: string; className: string; icon: any } } = {
      pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800', icon: Clock },
      preparing: { label: 'Preparing', className: 'bg-blue-100 text-blue-800', icon: Utensils },
      ready: { label: 'Ready', className: 'bg-green-100 text-green-800', icon: CheckCircle },
      served: { label: 'Served', className: 'bg-slate-100 text-slate-800', icon: CheckCircle },
      cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-800', icon: XCircle },
    };

    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${badge.className}`}>
        <Icon className="w-3.5 h-3.5" />
        {badge.label}
      </span>
    );
  };

  const getOrderTypeIcon = (orderType: string) => {
    const icons = {
      dine_in: <Utensils className="w-5 h-5 text-green-600" />,
      delivery: <Truck className="w-5 h-5 text-orange-600" />,
      take_away: <ShoppingBag className="w-5 h-5 text-blue-600" />,
    };
    return icons[orderType as keyof typeof icons] || icons.dine_in;
  };

  const filteredKOTs = kots.filter(kot => {
    const matchesSearch = kot.kot_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         kot.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         kot.table_number?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || kot.status === statusFilter;
    const matchesOrderType = orderTypeFilter === 'all' || kot.order_type === orderTypeFilter;
    return matchesSearch && matchesStatus && matchesOrderType;
  });

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-slate-900">Kitchen Order Tickets</h1>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          New KOT
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search KOTs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="preparing">Preparing</option>
            <option value="ready">Ready</option>
            <option value="served">Served</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={orderTypeFilter}
            onChange={(e) => setOrderTypeFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Order Types</option>
            <option value="dine_in">Dine In</option>
            <option value="delivery">Delivery</option>
            <option value="take_away">Take Away</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">KOT #</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Type</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Details</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Time</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredKOTs.map((kot) => (
                <tr key={kot.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{kot.kot_number}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getOrderTypeIcon(kot.order_type)}
                      <span className="text-sm capitalize">{kot.order_type.replace('_', ' ')}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {kot.order_type === 'dine_in' && <div>Table: {kot.table_number}</div>}
                    {kot.customer_name && <div>{kot.customer_name}</div>}
                    {kot.delivery_platform && <div>{kot.delivery_platform}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={kot.status}
                      onChange={(e) => handleUpdateStatus(kot.id, e.target.value)}
                      className="text-sm border border-slate-300 rounded px-2 py-1"
                      disabled={kot.status === 'served' || kot.status === 'cancelled'}
                    >
                      <option value="pending">Pending</option>
                      <option value="preparing">Preparing</option>
                      <option value="ready">Ready</option>
                      <option value="served">Served</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {new Date(kot.created_at).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleViewReceipt(kot)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                        title="View Order Receipt"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handlePrintKOT(kot)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Print KOT"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      {kot.status !== 'served' && kot.status !== 'cancelled' && (
                        <button
                          onClick={() => handleEdit(kot)}
                          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                          title="Edit KOT"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(kot.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Delete KOT"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-900">
                {editingKOT ? 'Edit KOT' : 'New Kitchen Order Ticket'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, order_type: 'dine_in' })}
                  className={`p-4 rounded-lg border-2 transition ${
                    formData.order_type === 'dine_in'
                      ? 'border-green-500 bg-green-50'
                      : 'border-slate-200 hover:border-green-300'
                  }`}
                >
                  <Utensils className="w-8 h-8 mx-auto mb-2 text-green-600" />
                  <div className="font-semibold">Dine In</div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, order_type: 'delivery' })}
                  className={`p-4 rounded-lg border-2 transition ${
                    formData.order_type === 'delivery'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-slate-200 hover:border-orange-300'
                  }`}
                >
                  <Truck className="w-8 h-8 mx-auto mb-2 text-orange-600" />
                  <div className="font-semibold">Delivery</div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, order_type: 'take_away' })}
                  className={`p-4 rounded-lg border-2 transition ${
                    formData.order_type === 'take_away'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-blue-300'
                  }`}
                >
                  <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                  <div className="font-semibold">Take Away</div>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {formData.order_type === 'dine_in' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Table Number *
                    </label>
                    <input
                      type="text"
                      value={formData.table_number}
                      onChange={(e) => setFormData({ ...formData, table_number: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required={formData.order_type === 'dine_in'}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Customer Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.customer_phone}
                    onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {formData.order_type === 'delivery' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Delivery Platform
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Zomato, Swiggy"
                        value={formData.delivery_platform}
                        onChange={(e) => setFormData({ ...formData, delivery_platform: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Platform Order ID
                      </label>
                      <input
                        type="text"
                        value={formData.delivery_order_id}
                        onChange={(e) => setFormData({ ...formData, delivery_order_id: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="border-t border-slate-200 pt-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Select Menu Items</h3>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6 max-h-60 overflow-y-auto p-2">
                  {menuItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleAddItem(item)}
                      className="p-3 border border-slate-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition text-left"
                    >
                      <div className="font-medium text-sm text-slate-900">{item.name}</div>
                      <div className="text-xs text-slate-600">{formatINR(item.price)}</div>
                    </button>
                  ))}
                </div>

                {selectedItems.length > 0 && (
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h4 className="font-semibold text-slate-900 mb-3">Selected Items</h4>
                    <div className="space-y-2">
                      {selectedItems.map((item) => (
                        <div key={item.menu_item_id} className="flex items-center justify-between gap-4 bg-white p-3 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{item.menu_item_name}</div>
                            <div className="text-xs text-slate-600">{formatINR(item.unit_price)} each</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(item.menu_item_id, item.quantity - 1)}
                              className="w-7 h-7 flex items-center justify-center bg-slate-200 hover:bg-slate-300 rounded"
                            >
                              -
                            </button>
                            <span className="w-8 text-center font-medium">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(item.menu_item_id, item.quantity + 1)}
                              className="w-7 h-7 flex items-center justify-center bg-slate-200 hover:bg-slate-300 rounded"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.menu_item_id)}
                              className="ml-2 p-1.5 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total:</span>
                        <span>{formatINR(calculateTotal())}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-4 pt-6 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-900 font-semibold rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
                >
                  {editingKOT ? 'Update KOT' : 'Create KOT'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
