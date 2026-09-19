import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";

export type Language = "en" | "pt" | "fr" | "af";

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  pt: "Português",
  fr: "Français",
  af: "Afrikaans",
};

export const LANGUAGE_FLAGS: Record<Language, string> = {
  en: "🇬🇧",
  pt: "🇵🇹",
  fr: "🇫🇷",
  af: "🇿🇦",
};

type Translations = typeof en;

const en = {
  // Navigation
  nav_dashboard: "Dashboard",
  nav_statistics: "Statistics",
  nav_front_desk: "Front Desk & Bookings",
  nav_rooms_pricing: "Rooms & Pricing",
  nav_properties: "Properties & Lodges",
  nav_tenants: "Tenants & Leases",
  nav_maintenance: "Maintenance Hub",
  nav_work_orders: "Work Orders",
  nav_providers: "Service Providers",
  nav_inspections: "Inspections",
  nav_scheduled_tasks: "Scheduled Tasks",
  nav_inventory: "Inventory & Stock",
  nav_rent: "Rent & Revenue",
  nav_invoices: "Invoices",
  nav_bills: "Bills & Schedules",
  nav_accounts: "Financial Accounts",
  nav_reports: "Financial Reports",
  nav_hr: "HR & Payroll",
  nav_procurement: "Procurement Hub",
  nav_stores: "Stores & Inventory",
  nav_showcase: "Showcase",
  nav_enquiries: "Enquiries & Tickets",
  nav_portal: "Public Portal",
  nav_agent_mode: "Agent Mode",
  nav_marketing: "Marketing Hub",
  nav_it: "IT & Systems Hub",
  nav_users: "Users & Rights",
  nav_organogram: "Organogram & Roles",
  nav_contracts: "Contracts",
  nav_settings: "Settings",
  nav_audit: "Audit Department",
  // Header actions
  header_check_in: "Check In",
  header_record_rent: "Record Rent Payment",
  header_request_leave: "Request Leave",
  header_sign_out: "Sign out",
  header_search_placeholder: "Search rooms, bookings, guests, invoices, staff...",
  // Common actions
  action_save: "Save",
  action_cancel: "Cancel",
  action_delete: "Delete",
  action_edit: "Edit",
  action_add: "Add",
  action_confirm: "Confirm",
  action_close: "Close",
  action_submit: "Submit",
  action_loading: "Loading...",
  action_search: "Search",
  action_filter: "Filter",
  action_download: "Download",
  action_upload: "Upload",
  action_view: "View",
  action_send: "Send",
  action_generate: "Generate",
  action_approve: "Approve",
  action_reject: "Reject",
  action_record: "Record",
  action_assign: "Assign",
  // Common labels
  label_name: "Name",
  label_email: "Email",
  label_phone: "Phone",
  label_address: "Address",
  label_date: "Date",
  label_amount: "Amount",
  label_status: "Status",
  label_notes: "Notes",
  label_property: "Property",
  label_tenant: "Tenant",
  label_payment: "Payment",
  label_method: "Method",
  label_reference: "Reference",
  label_total: "Total",
  label_balance: "Balance",
  label_paid: "Paid",
  label_due: "Due",
  label_overdue: "Overdue",
  label_active: "Active",
  label_inactive: "Inactive",
  label_all: "All",
  label_none: "None",
  label_description: "Description",
  label_type: "Type",
  label_category: "Category",
  label_priority: "Priority",
  label_created_at: "Created At",
  label_updated_at: "Updated At",
  label_company: "Company",
  label_language: "Language",
  // Sections
  section_hospitality: "Hospitality & Core",
  section_operations: "Operations & Maintenance",
  section_finance: "Finance & Accounts",
  section_hr: "Human Resources",
  section_procurement: "Procurement & Stores",
  section_portal: "Customer Portal",
  section_marketing: "Marketing & Growth",
  section_it: "IT, Administration & Audit",
  // Check-in
  checkin_title: "Guest Check-In & Booking Center",
  checkin_instant: "Instant Walk-in",
  checkin_verify: "Verify Code",
  checkin_guest_name: "Guest Full Name",
  checkin_guest_phone: "Guest Phone",
  checkin_guest_email: "Guest Email",
  checkin_guest_id: "Guest ID/Passport Number",
  checkin_check_in_date: "Check-In Date",
  checkin_check_out_date: "Check-Out Date",
  // Rent
  rent_record_payment: "Record Rent Payment",
  rent_assigned_property: "Assigned Property",
  rent_payment_date: "Payment Date",
  rent_billing_month: "Billing Month",
  rent_payment_method: "Payment Method",
  rent_amount_received: "Amount Received (NAD)",
  rent_required: "Required Rent",
  rent_proof_upload: "Proof of Payment (POP) File",
  // Status labels
  status_active: "Active",
  status_inactive: "Inactive",
  status_pending: "Pending",
  status_confirmed: "Confirmed",
  status_completed: "Completed",
  status_cancelled: "Cancelled",
  status_checked_in: "Checked In",
  status_checked_out: "Checked Out",
};

const pt: Translations = {
  nav_dashboard: "Painel",
  nav_statistics: "Estatísticas",
  nav_front_desk: "Recepção & Reservas",
  nav_rooms_pricing: "Quartos & Preços",
  nav_properties: "Propriedades & Alojamentos",
  nav_tenants: "Inquilinos & Contratos",
  nav_maintenance: "Centro de Manutenção",
  nav_work_orders: "Ordens de Serviço",
  nav_providers: "Prestadores de Serviço",
  nav_inspections: "Inspeções",
  nav_scheduled_tasks: "Tarefas Programadas",
  nav_inventory: "Inventário & Stock",
  nav_rent: "Renda & Receitas",
  nav_invoices: "Faturas",
  nav_bills: "Contas & Agendamentos",
  nav_accounts: "Contas Financeiras",
  nav_reports: "Relatórios Financeiros",
  nav_hr: "RH & Folha de Pagamento",
  nav_procurement: "Centro de Compras",
  nav_stores: "Armazéns & Inventário",
  nav_showcase: "Vitrine",
  nav_enquiries: "Consultas & Tickets",
  nav_portal: "Portal Público",
  nav_agent_mode: "Modo Agente",
  nav_marketing: "Hub de Marketing",
  nav_it: "Hub de TI & Sistemas",
  nav_users: "Utilizadores & Direitos",
  nav_organogram: "Organograma & Funções",
  nav_contracts: "Contratos",
  nav_settings: "Configurações",
  nav_audit: "Departamento de Auditoria",
  header_check_in: "Check-In",
  header_record_rent: "Registar Pagamento de Renda",
  header_request_leave: "Pedir Licença",
  header_sign_out: "Sair",
  header_search_placeholder: "Pesquisar quartos, reservas, hóspedes, faturas, pessoal...",
  action_save: "Guardar",
  action_cancel: "Cancelar",
  action_delete: "Eliminar",
  action_edit: "Editar",
  action_add: "Adicionar",
  action_confirm: "Confirmar",
  action_close: "Fechar",
  action_submit: "Enviar",
  action_loading: "A carregar...",
  action_search: "Pesquisar",
  action_filter: "Filtrar",
  action_download: "Descarregar",
  action_upload: "Carregar",
  action_view: "Ver",
  action_send: "Enviar",
  action_generate: "Gerar",
  action_approve: "Aprovar",
  action_reject: "Rejeitar",
  action_record: "Registar",
  action_assign: "Atribuir",
  label_name: "Nome",
  label_email: "Email",
  label_phone: "Telefone",
  label_address: "Endereço",
  label_date: "Data",
  label_amount: "Valor",
  label_status: "Estado",
  label_notes: "Notas",
  label_property: "Propriedade",
  label_tenant: "Inquilino",
  label_payment: "Pagamento",
  label_method: "Método",
  label_reference: "Referência",
  label_total: "Total",
  label_balance: "Saldo",
  label_paid: "Pago",
  label_due: "A Vencer",
  label_overdue: "Em Atraso",
  label_active: "Ativo",
  label_inactive: "Inativo",
  label_all: "Todos",
  label_none: "Nenhum",
  label_description: "Descrição",
  label_type: "Tipo",
  label_category: "Categoria",
  label_priority: "Prioridade",
  label_created_at: "Criado Em",
  label_updated_at: "Atualizado Em",
  label_company: "Empresa",
  label_language: "Idioma",
  section_hospitality: "Hospitalidade & Núcleo",
  section_operations: "Operações & Manutenção",
  section_finance: "Finanças & Contas",
  section_hr: "Recursos Humanos",
  section_procurement: "Compras & Armazéns",
  section_portal: "Portal do Cliente",
  section_marketing: "Marketing & Crescimento",
  section_it: "TI, Administração & Auditoria",
  checkin_title: "Centro de Check-In & Reservas",
  checkin_instant: "Entrada Imediata",
  checkin_verify: "Verificar Código",
  checkin_guest_name: "Nome Completo do Hóspede",
  checkin_guest_phone: "Telefone do Hóspede",
  checkin_guest_email: "Email do Hóspede",
  checkin_guest_id: "Número de BI/Passaporte",
  checkin_check_in_date: "Data de Entrada",
  checkin_check_out_date: "Data de Saída",
  rent_record_payment: "Registar Pagamento de Renda",
  rent_assigned_property: "Propriedade Atribuída",
  rent_payment_date: "Data de Pagamento",
  rent_billing_month: "Mês de Faturação",
  rent_payment_method: "Método de Pagamento",
  rent_amount_received: "Valor Recebido (NAD)",
  rent_required: "Renda Necessária",
  rent_proof_upload: "Comprovativo de Pagamento (CP)",
  status_active: "Ativo",
  status_inactive: "Inativo",
  status_pending: "Pendente",
  status_confirmed: "Confirmado",
  status_completed: "Concluído",
  status_cancelled: "Cancelado",
  status_checked_in: "Check-In Efetuado",
  status_checked_out: "Check-Out Efetuado",
};

const fr: Translations = {
  nav_dashboard: "Tableau de bord",
  nav_statistics: "Statistiques",
  nav_front_desk: "Réception & Réservations",
  nav_rooms_pricing: "Chambres & Tarifs",
  nav_properties: "Propriétés & Lodges",
  nav_tenants: "Locataires & Baux",
  nav_maintenance: "Centre de Maintenance",
  nav_work_orders: "Ordres de Travail",
  nav_providers: "Prestataires de Service",
  nav_inspections: "Inspections",
  nav_scheduled_tasks: "Tâches Planifiées",
  nav_inventory: "Inventaire & Stock",
  nav_rent: "Loyer & Revenus",
  nav_invoices: "Factures",
  nav_bills: "Factures & Échéanciers",
  nav_accounts: "Comptes Financiers",
  nav_reports: "Rapports Financiers",
  nav_hr: "RH & Paie",
  nav_procurement: "Centre d'Achats",
  nav_stores: "Magasins & Inventaire",
  nav_showcase: "Vitrine",
  nav_enquiries: "Demandes & Tickets",
  nav_portal: "Portail Public",
  nav_agent_mode: "Mode Agent",
  nav_marketing: "Hub Marketing",
  nav_it: "Hub IT & Systèmes",
  nav_users: "Utilisateurs & Droits",
  nav_organogram: "Organigramme & Rôles",
  nav_contracts: "Contrats",
  nav_settings: "Paramètres",
  nav_audit: "Département d'Audit",
  header_check_in: "Enregistrement",
  header_record_rent: "Enregistrer Paiement",
  header_request_leave: "Demander un Congé",
  header_sign_out: "Déconnexion",
  header_search_placeholder: "Rechercher chambres, réservations, clients, factures, personnel...",
  action_save: "Enregistrer",
  action_cancel: "Annuler",
  action_delete: "Supprimer",
  action_edit: "Modifier",
  action_add: "Ajouter",
  action_confirm: "Confirmer",
  action_close: "Fermer",
  action_submit: "Soumettre",
  action_loading: "Chargement...",
  action_search: "Rechercher",
  action_filter: "Filtrer",
  action_download: "Télécharger",
  action_upload: "Téléverser",
  action_view: "Voir",
  action_send: "Envoyer",
  action_generate: "Générer",
  action_approve: "Approuver",
  action_reject: "Rejeter",
  action_record: "Enregistrer",
  action_assign: "Assigner",
  label_name: "Nom",
  label_email: "E-mail",
  label_phone: "Téléphone",
  label_address: "Adresse",
  label_date: "Date",
  label_amount: "Montant",
  label_status: "Statut",
  label_notes: "Notes",
  label_property: "Propriété",
  label_tenant: "Locataire",
  label_payment: "Paiement",
  label_method: "Méthode",
  label_reference: "Référence",
  label_total: "Total",
  label_balance: "Solde",
  label_paid: "Payé",
  label_due: "À Payer",
  label_overdue: "En Retard",
  label_active: "Actif",
  label_inactive: "Inactif",
  label_all: "Tous",
  label_none: "Aucun",
  label_description: "Description",
  label_type: "Type",
  label_category: "Catégorie",
  label_priority: "Priorité",
  label_created_at: "Créé le",
  label_updated_at: "Mis à jour le",
  label_company: "Entreprise",
  label_language: "Langue",
  section_hospitality: "Hospitalité & Noyau",
  section_operations: "Opérations & Maintenance",
  section_finance: "Finance & Comptes",
  section_hr: "Ressources Humaines",
  section_procurement: "Achats & Magasins",
  section_portal: "Portail Client",
  section_marketing: "Marketing & Croissance",
  section_it: "IT, Administration & Audit",
  checkin_title: "Centre d'Enregistrement & Réservations",
  checkin_instant: "Entrée Immédiate",
  checkin_verify: "Vérifier Code",
  checkin_guest_name: "Nom Complet du Client",
  checkin_guest_phone: "Téléphone du Client",
  checkin_guest_email: "E-mail du Client",
  checkin_guest_id: "Numéro de Passeport/CI",
  checkin_check_in_date: "Date d'Arrivée",
  checkin_check_out_date: "Date de Départ",
  rent_record_payment: "Enregistrer Paiement de Loyer",
  rent_assigned_property: "Propriété Assignée",
  rent_payment_date: "Date de Paiement",
  rent_billing_month: "Mois de Facturation",
  rent_payment_method: "Mode de Paiement",
  rent_amount_received: "Montant Reçu (NAD)",
  rent_required: "Loyer Requis",
  rent_proof_upload: "Justificatif de Paiement",
  status_active: "Actif",
  status_inactive: "Inactif",
  status_pending: "En attente",
  status_confirmed: "Confirmé",
  status_completed: "Terminé",
  status_cancelled: "Annulé",
  status_checked_in: "Enregistré",
  status_checked_out: "Parti",
};

const af: Translations = {
  nav_dashboard: "Kontroleskerm",
  nav_statistics: "Statistieke",
  nav_front_desk: "Ontvangsbalie & Besprekings",
  nav_rooms_pricing: "Kamers & Pryse",
  nav_properties: "Eiendomme & Lodges",
  nav_tenants: "Huurders & Huurooreenkoms",
  nav_maintenance: "Onderhoudsentrum",
  nav_work_orders: "Werkopdragte",
  nav_providers: "Diensverskaffers",
  nav_inspections: "Inspeksies",
  nav_scheduled_tasks: "Beplande Take",
  nav_inventory: "Inventaris & Voorraad",
  nav_rent: "Huur & Inkomste",
  nav_invoices: "Fakture",
  nav_bills: "Rekeninge & Skedules",
  nav_accounts: "Finansiële Rekeninge",
  nav_reports: "Finansiële Verslae",
  nav_hr: "MH & Betaalstaat",
  nav_procurement: "Aankoopsentrum",
  nav_stores: "Winkels & Inventaris",
  nav_showcase: "Uitstallings",
  nav_enquiries: "Navrae & Tikette",
  nav_portal: "Openbare Portaal",
  nav_agent_mode: "Agentmodus",
  nav_marketing: "Bemarkingsentrum",
  nav_it: "IT & Stelsels",
  nav_users: "Gebruikers & Regte",
  nav_organogram: "Organogram & Rolle",
  nav_contracts: "Kontrakte",
  nav_settings: "Instellings",
  nav_audit: "Ouditeringsdepartement",
  header_check_in: "Inskakel",
  header_record_rent: "Huurbetalingrekord",
  header_request_leave: "Verlof Aanvra",
  header_sign_out: "Teken Uit",
  header_search_placeholder: "Soek kamers, besprekings, gaste, fakture, personeel...",
  action_save: "Stoor",
  action_cancel: "Kanselleer",
  action_delete: "Verwyder",
  action_edit: "Redigeer",
  action_add: "Voeg By",
  action_confirm: "Bevestig",
  action_close: "Sluit",
  action_submit: "Indien",
  action_loading: "Laai tans...",
  action_search: "Soek",
  action_filter: "Filter",
  action_download: "Aflaai",
  action_upload: "Oplaai",
  action_view: "Bekyk",
  action_send: "Stuur",
  action_generate: "Genereer",
  action_approve: "Keur Goed",
  action_reject: "Verwerp",
  action_record: "Rekord",
  action_assign: "Toewys",
  label_name: "Naam",
  label_email: "E-pos",
  label_phone: "Telefoon",
  label_address: "Adres",
  label_date: "Datum",
  label_amount: "Bedrag",
  label_status: "Status",
  label_notes: "Notas",
  label_property: "Eiendom",
  label_tenant: "Huurder",
  label_payment: "Betaling",
  label_method: "Metode",
  label_reference: "Verwysing",
  label_total: "Totaal",
  label_balance: "Saldo",
  label_paid: "Betaal",
  label_due: "Verskuldig",
  label_overdue: "Agterstallig",
  label_active: "Aktief",
  label_inactive: "Onaktief",
  label_all: "Alle",
  label_none: "Geen",
  label_description: "Beskrywing",
  label_type: "Tipe",
  label_category: "Kategorie",
  label_priority: "Prioriteit",
  label_created_at: "Geskep Op",
  label_updated_at: "Opgedateer Op",
  label_company: "Maatskappy",
  label_language: "Taal",
  section_hospitality: "Gasvryheid & Kern",
  section_operations: "Bedrywighede & Onderhoud",
  section_finance: "Finansies & Rekeninge",
  section_hr: "Menslike Hulpbronne",
  section_procurement: "Aankope & Winkels",
  section_portal: "Kliëntportaal",
  section_marketing: "Bemarking & Groei",
  section_it: "IT, Administrasie & Ouditering",
  checkin_title: "Gaste-Inskakel & Besprekinsgsentrum",
  checkin_instant: "Dadelike Inskakel",
  checkin_verify: "Verifieer Kode",
  checkin_guest_name: "Gas se Volle Naam",
  checkin_guest_phone: "Gas se Telefoon",
  checkin_guest_email: "Gas se E-pos",
  checkin_guest_id: "ID/Paspoortnommer",
  checkin_check_in_date: "Inskakeldatum",
  checkin_check_out_date: "Uitskakeldatum",
  rent_record_payment: "Registreer Huurbetaling",
  rent_assigned_property: "Toegewysde Eiendom",
  rent_payment_date: "Betalingsdatum",
  rent_billing_month: "Faktureringsmaand",
  rent_payment_method: "Betalingsmetode",
  rent_amount_received: "Bedrag Ontvang (NAD)",
  rent_required: "Vereiste Huur",
  rent_proof_upload: "Bewys van Betaling",
  status_active: "Aktief",
  status_inactive: "Onaktief",
  status_pending: "Hangende",
  status_confirmed: "Bevestig",
  status_completed: "Voltooi",
  status_cancelled: "Gekanselleer",
  status_checked_in: "Ingeskakel",
  status_checked_out: "Uitgeskakel",
};

const translations: Record<Language, Translations> = { en, pt, fr, af };

/* =========================================================================
   COMPREHENSIVE PORTUGUESE DICTIONARY & TRANSLATION ENGINE
   ========================================================================= */

export const PT_DICTIONARY: Record<string, string> = {
  // Navigation & Sections
  "Hospitality & Core": "Hospitalidade & Núcleo",
  "Operations & Maintenance": "Operações & Manutenção",
  "Finance & Accounts": "Finanças & Contas",
  "Human Resources": "Recursos Humanos",
  "Procurement & Stores": "Compras & Armazéns",
  "Customer Portal": "Portal do Cliente",
  "Marketing & Growth": "Marketing & Crescimento",
  "IT, Administration & Audit": "TI, Administração & Auditoria",

  // Finance & Accounts Page
  "Record daily financial operations, manage invoices & proofs, approve procurement disbursements, and generate certified balance sheets.":
    "Registar operações financeiras diárias, gerir faturas e comprovativos, aprovar desembolsos de compras e gerar balanços certificados.",
  "Daily Journal & Transactions": "Diário & Transações",
  "Daily Balance Sheet & Statements": "Balanço Diário & Extratos",
  "Procurement Payment Requests": "Pedidos de Pagamento de Compras",
  "Pending Matters": "Assuntos Pendentes",
  "Generate Statement & Report": "Gerar Extrato & Relatório",
  "Record Transaction": "Registar Transação",
  "Today's Inflow (Revenue)": "Entradas de Hoje (Receita)",
  "Rent & operating receipts": "Rendas e receitas operacionais",
  "Today's Outflow (Expenses)": "Saídas de Hoje (Despesas)",
  "Disbursements & utilities": "Desembolsos e utilidades",
  "Today's Net Cashflow": "Fluxo de Caixa Líquido de Hoje",
  "Operating balance today": "Saldo operacional de hoje",
  "Pending Approvals": "Aprovações Pendentes",
  "Click to review queue →": "Clique para rever a fila →",
  "Search transactions by reference, description, category, staff...":
    "Pesquisar transações por referência, descrição, categoria, funcionário...",
  "All Types": "Todos os Tipos",
  "All Statuses": "Todos os Estados",
  "Date": "Data",
  "Type": "Tipo",
  "Category": "Categoria",
  "Description & Summary": "Descrição & Resumo",
  "Reference / Proof": "Referência / Comprovativo",
  "Recorded By": "Registado Por",
  "Amount": "Valor",
  "Status": "Estado",
  "Approved": "Aprovado",
  "Pending": "Pendente",
  "Rejected": "Rejeitado",
  "income": "Receita",
  "expense": "Despesa",
  "Income": "Receita",
  "Expense": "Despesa",
  "Rent Collection": "Cobrança de Renda",
  "Disbursement": "Desembolso",
  "Utilities": "Serviços & Utilidades",
  "Refund": "Reembolso",
  "Salary": "Salário",
  "Deposit": "Depósito",
  "Certified Balance Sheet": "Balanço Certificado",
  "Assets": "Ativos",
  "Liabilities": "Passivos",
  "Equity": "Capital Próprio",
  "Opening Balance": "Saldo Inicial",
  "Closing Balance": "Saldo Final",
  "Net Cashflow": "Fluxo de Caixa Líquido",

  // Financial Reports Page
  "Reports": "Relatórios",
  "Financial Reports": "Relatórios Financeiros",
  "Financial analytics and summaries.": "Análises e resumos financeiros.",
  "Export Report CSV": "Exportar Relatório CSV",
  "Refresh": "Atualizar",
  "Total Invoiced": "Total Faturado",
  "Total Paid": "Total Pago",
  "Total Overdue": "Total em Atraso",
  "Collection Rate": "Taxa de Cobrança",
  "Invoice Status Breakdown": "Distribuição de Faturas por Estado",
  "Paid": "Pago",
  "Sent": "Enviado",
  "Draft": "Rascunho",
  "Overdue": "Em Atraso",
  "Cancelled": "Cancelado",
  "Monthly Cashflow": "Fluxo de Caixa Mensal",
  "Month": "Mês",
  "Expenses": "Despesas",
  "Net": "Líquido",

  // Invoices & Billing
  "Invoices": "Faturas",
  "Create, manage, and track tenant and commercial client invoices.":
    "Criar, gerir e acompanhar faturas de inquilinos e clientes comerciais.",
  "Create Invoice": "Criar Fatura",
  "Invoice Number": "Número da Fatura",
  "Invoice Date": "Data da Fatura",
  "Due Date": "Data de Vencimento",
  "Bill To": "Faturar A",
  "Recipient": "Destinatário",
  "Line Items": "Itens da Fatura",
  "Item": "Item",
  "Qty": "Qtd",
  "Rate": "Tarifa",
  "Subtotal": "Subtotal",
  "VAT (15%)": "IVA (15%)",
  "VAT Inclusive": "IVA Incluído",
  "Grand Total": "Total Geral",
  "Suppress Invoice": "Ocultar Fatura",
  "Suppressed": "Ocultada",
  "Unsuppress": "Reativar",
  "Download PDF": "Descarregar PDF",
  "Print Invoice": "Imprimir Fatura",
  "Send via Email": "Enviar por Email",
  "Mark as Paid": "Marcar como Pago",
  "Mark as Sent": "Marcar como Enviado",
  "Status Breakdown": "Divisão por Estado",
  "Bills & Schedules": "Contas & Agendamentos",
  "Recurring bills, vendor payables, and scheduled expenses.":
    "Contas recorrentes, pagamentos a fornecedores e despesas agendadas.",
  "Add Bill": "Adicionar Conta",
  "Vendor": "Fornecedor",
  "Frequency": "Frequência",
  "Recurring": "Recorrente",
  "One-off": "Pontual",
  "Next Due Date": "Próximo Vencimento",
  "Auto-pay": "Pagamento Automático",

  // Tenants & Leases Page
  "Tenants & Leases": "Inquilinos & Contratos",
  "Manage active leases, tenant profiles, contracts, and monthly collections.":
    "Gerir contratos ativos, perfis de inquilinos, acordos e cobranças mensais.",
  "All Tenants": "Todos os Inquilinos",
  "Active Leases": "Contratos Ativos",
  "Expiring Soon": "A Expirar em Breve",
  "Overdue Rent": "Renda em Atraso",
  "Add Tenant": "Adicionar Inquilino",
  "Record Rent Payment": "Registar Pagamento de Renda",
  "Assigned Residence": "Residência Atribuída",
  "Assigned Property": "Propriedade Atribuída",
  "Billing Month": "Mês de Faturação",
  "Payment Method": "Método de Pagamento",
  "Amount Received": "Valor Recebido",
  "Amount Received (NAD)": "Valor Recebido (NAD)",
  "Required Rent": "Renda Necessária",
  "Proof of Payment (POP) File": "Comprovativo de Pagamento (CP)",
  "Attach POP / Receipt": "Anexar Comprovativo / Recibo",
  "Upload Receipt / POP": "Carregar Recibo / Comprovativo",
  "View POP": "Ver Comprovativo",
  "Download POP": "Descarregar Comprovativo",
  "No POP attached": "Nenhum comprovativo anexado",
  "POP uploaded": "Comprovativo anexado",
  "Lease Agreement": "Contrato de Arrendamento",
  "Security Deposit": "Depósito de Caução",
  "Move-in Date": "Data de Entrada",
  "Move-out Date": "Data de Saída",
  "Monthly Rent": "Renda Mensal",
  "Payment History": "Histórico de Pagamentos",
  "Tenant Name": "Nome do Inquilino",
  "Phone Number": "Número de Telefone",
  "Email Address": "Endereço de Email",
  "ID Number": "Número de Identificação",
  "Emergency Contact": "Contacto de Emergência",
  "Bank Transfer": "Transferência Bancária",
  "Cash": "Dinheiro",
  "Credit Card": "Cartão de Crédito",
  "Debit Card": "Cartão de Débito",
  "Mobile Money": "Dinheiro Móvel",

  // Front Desk & Bookings
  "Front Desk & Bookings": "Recepção & Reservas",
  "Guest Check-In & Booking Center": "Centro de Check-In & Reservas",
  "Manage reservations, walk-ins, guest stays, and departures.":
    "Gerir reservas, entradas diretas, estadias de hóspedes e partidas.",
  "Check-In": "Check-In",
  "Check-Out": "Check-Out",
  "Instant Walk-in": "Entrada Imediata",
  "Verify Code": "Verificar Código",
  "Guest Full Name": "Nome Completo do Hóspede",
  "Guest Phone": "Telefone do Hóspede",
  "Guest Email": "Email do Hóspede",
  "Guest ID/Passport Number": "Número de BI/Passaporte",
  "Check-In Date": "Data de Entrada",
  "Check-Out Date": "Data de Saída",
  "Booking Reference": "Referência da Reserva",
  "Room Number": "Número do Quarto",
  "Room Type": "Tipo de Quarto",
  "Occupancy": "Ocupação",
  "Available": "Disponível",
  "Occupied": "Ocupado",
  "Reserved": "Reservado",
  "Cleaning": "Em Limpeza",
  "Out of Service": "Fora de Serviço",
  "Daily Rate": "Tarifa Diária",
  "Nightly Rate": "Tarifa por Noite",
  "Total Nights": "Total de Noites",
  "Confirm Check-in": "Confirmar Check-In",
  "Confirm Check-out": "Confirmar Check-Out",
  "Key Handover": "Entrega de Chaves",
  "Key Returned": "Chave Devolvida",
  "Commercial Bookings": "Reservas Comerciais",
  "Room Bookings": "Reservas de Quartos",
  "Guest Management": "Gestão de Hóspedes",

  // Rooms & Pricing
  "Rooms & Pricing": "Quartos & Preços",
  "Manage room inventory, tiered pricing, amenities, and seasonal rates.":
    "Gerir inventário de quartos, escalões de preços, comodidades e tarifas sazonais.",
  "Add Room": "Adicionar Quarto",
  "Edit Room": "Editar Quarto",
  "Room Name": "Nome do Quarto",
  "Base Price": "Preço Base",
  "Weekend Rate": "Tarifa de Fim de Semana",
  "Amenities": "Comodidades",
  "Capacity": "Capacidade",
  "Bed Type": "Tipo de Cama",
  "Floor": "Piso",

  // Properties & Lodges
  "Properties & Lodges": "Propriedades & Alojamentos",
  "Portfolio management, units, addresses, and property status.":
    "Gestão de carteira de imóveis, frações, moradas e estado das propriedades.",
  "Add Property": "Adicionar Propriedade",
  "Property Name": "Nome da Propriedade",
  "Address": "Morada",
  "City": "Cidade",
  "Country": "País",
  "Property Type": "Tipo de Propriedade",
  "Apartment": "Apartamento",
  "House": "Casa",
  "Lodge": "Alojamento / Lodge",
  "Commercial": "Comercial",
  "Publish Listing": "Publicar Imóvel",
  "Unpublish": "Despublicar",
  "Published": "Publicado",
  "Unpublished": "Não Publicado",

  // Procurement Hub
  "Procurement Hub": "Centro de Compras",
  "Manage purchase orders, supplier requisitions, requests and approvals.":
    "Gerir ordens de compra, requisições a fornecedores, pedidos e aprovações.",
  "Request Procurement": "Pedir Compra",
  "View Requests & Approvals": "Ver Pedidos & Aprovações",
  "Procure": "Comprar",
  "Item Description": "Descrição do Item",
  "Quantity": "Quantidade",
  "Unit Price": "Preço Unitário",
  "Total Estimated Cost": "Custo Total Estimado",
  "Department": "Departamento",
  "Reason / Purpose": "Motivo / Finalidade",
  "Urgency / Priority": "Urgência / Prioridade",
  "Approval Routing": "Encaminhamento de Aprovação",
  "Departmental Approval": "Aprovação Departamental",
  "Manager Approval": "Aprovação do Gerente",
  "Finance Approval": "Aprovação Financeira",
  "Submit Procurement Request": "Submeter Pedido de Compra",
  "Purchase Orders": "Ordens de Compra",
  "Suppliers": "Fornecedores",
  "Disbursement Status": "Estado de Desembolso",

  // Maintenance & Operations
  "Maintenance Hub": "Centro de Manutenção",
  "Track maintenance requests, repairs, preventative work, and service costs.":
    "Acompanhar pedidos de manutenção, reparações, trabalhos preventivos e custos de serviço.",
  "Work Orders": "Ordens de Serviço",
  "Service Providers": "Prestadores de Serviço",
  "Inspections": "Inspeções",
  "Scheduled Tasks": "Tarefas Programadas",
  "Create Work Order": "Criar Ordem de Serviço",
  "Priority": "Prioridade",
  "High": "Alta",
  "Medium": "Média",
  "Low": "Baixa",
  "Critical": "Crítica",
  "Open": "Aberto",
  "In Progress": "Em Progresso",
  "Resolved": "Resolvido",
  "Closed": "Fechado",
  "Assignee": "Responsável",
  "Contractor": "Empreiteiro",
  "Cost": "Custo",

  // Stores & Inventory
  "Stores & Inventory": "Armazéns & Inventário",
  "Manage warehouse inventory, consumables, linen, and equipment.":
    "Gerir inventário do armazém, consumíveis, roupa de cama e equipamentos.",
  "Stock Level": "Nível de Stock",
  "In Stock": "Em Stock",
  "Low Stock": "Stock Baixo",
  "Out of Stock": "Esgotado",
  "Reorder Point": "Ponto de Encomenda",
  "Stock In": "Entrada de Stock",
  "Stock Out": "Saída de Stock",

  // HR & Payroll
  "HR & Payroll": "RH & Folha de Pagamento",
  "Staff directory, leave management, attendance, and payroll processing.":
    "Diretório de funcionários, gestão de licenças, assiduidade e processamento salarial.",
  "Employees": "Funcionários",
  "Leave Requests": "Pedidos de Licença",
  "Payroll Summary": "Resumo de Salários",
  "Request Leave": "Pedir Licença",
  "Annual Leave": "Licença Anual",
  "Sick Leave": "Baixa Médica",
  "Compassionate Leave": "Licença por Falecimento",
  "Unpaid Leave": "Licença Sem Vencimento",
  "Leave Balance": "Saldo de Licenças",
  "Basic Salary": "Salário Base",
  "Deductions": "Deduções",
  "Net Salary": "Salário Líquido",
  "Pay Slip": "Recibo de Vencimento",

  // Marketing Hub
  "Marketing Hub": "Hub de Marketing",
  "Campaigns, promotional boosts, social media ad copy, and analytics.":
    "Campanhas, promoções de destaque, textos publicitários para redes sociais e métricas.",
  "Boost Published Listings": "Promover Imóveis Publicados",
  "Boost Tier": "Nível de Destaque",
  "Sponsored": "Patrocinado",
  "Featured": "Destaque",
  "Standard": "Padrão",
  "Premium Sponsor": "Patrocinador Premium",
  "Geo Targeting": "Segmentação Geográfica",
  "Target Globally": "Segmentação Global",
  "Target Countries": "Países Alvo",
  "Target Cities": "Cidades Alvo",
  "Generate High-Converting Ad Copy": "Gerar Texto Publicitário de Alta Conversão",
  "Social Media Ad Copy": "Texto para Redes Sociais",
  "Sponsored Label": "Etiqueta Patrocinada",
  "Hot Deal": "Grande Oportunidade",
  "Top Pick": "Escolha Principal",
  "Quick Move-In": "Entrada Rápida",
  "Special Offer": "Oferta Especial",

  // Public & Customer Portal
  "Public Portal": "Portal Público",
  "Browse Listings": "Explorar Imóveis",
  "Rooms, Lodges & Rentals": "Quartos, Alojamentos & Alugueres",
  "Inquiries & Support": "Consultas & Suporte",
  "Sign In": "Iniciar Sessão",
  "Sign in below ↓": "Inicie sessão abaixo ↓",
  "Create Account": "Criar Conta",
  "Create Tenant & Customer Account": "Criar Conta de Inquilino & Cliente",
  "Welcome Back": "Bem-vindo de Volta",
  "Manager Login": "Acesso Gerente",
  "Staff & Property Management Portal": "Portal de Funcionários & Gestão Imobiliária",
  "Bookings": "Reservas",
  "My Inquiries": "As Minhas Consultas",
  "My Account": "A Minha Conta",

  // IT, Administration & Settings
  "IT & Systems Hub": "Hub de TI & Sistemas",
  "Users & Rights": "Utilizadores & Direitos",
  "Organogram & Roles": "Organograma & Funções",
  "Contracts": "Contratos",
  "Settings": "Configurações",
  "Audit Department": "Departamento de Auditoria",
  "Audit Log": "Registo de Auditoria",
  "Action Performed": "Ação Realizada",
  "IP Address": "Endereço IP",
  "User Role": "Função do Utilizador",
  "Admin": "Administrador",
  "Manager": "Gerente",
  "Staff": "Funcionário",
  "Accountant": "Contabilista",
  "Save Changes": "Guardar Alterações",
  "Phase 1 skeleton ready for implementation.": "Estrutura da Fase 1 pronta para implementação.",

  // General Actions & Labels
  "Save": "Guardar",
  "Cancel": "Cancelar",
  "Delete": "Eliminar",
  "Edit": "Editar",
  "Add": "Adicionar",
  "Confirm": "Confirmar",
  "Close": "Fechar",
  "Submit": "Enviar",
  "Loading...": "A carregar...",
  "Search": "Pesquisar",
  "Filter": "Filtrar",
  "Download": "Descarregar",
  "Upload": "Carregar",
  "View": "Ver",
  "Send": "Enviar",
  "Generate": "Gerar",
  "Approve": "Aprovar",
  "Reject": "Rejeitar",
  "Record": "Registar",
  "Assign": "Atribuir",
  "Name": "Nome",
  "Email": "Email",
  "Phone": "Telefone",
  "Total": "Total",
  "Balance": "Saldo",
  "Active": "Ativo",
  "Inactive": "Inativo",
  "All": "Todos",
  "None": "Nenhum",
  "Notes": "Notas",
  "Property": "Propriedade",
  "Tenant": "Inquilino",
  "Payment": "Pagamento",
  "Method": "Método",
  "Reference": "Referência",
  "Company": "Empresa",
  "Language": "Idioma",
  "Actions": "Ações",
  "Action": "Ação",
  "Details": "Detalhes",
  "Back": "Voltar",
  "Next": "Seguinte",
  "Previous": "Anterior",
  "Select": "Selecionar",
  "Choose": "Escolher",
  "Clear": "Limpar",
  "Apply": "Aplicar",
  "Reset": "Redefinir",
  "No data available": "Sem dados disponíveis",
  "No records found": "Nenhum registo encontrado",
  "Loading data...": "A carregar dados...",
  "Please wait...": "Por favor aguarde...",
  "Success": "Sucesso",
  "Error": "Erro",
  "Warning": "Aviso",
  "Yes": "Sim",
  "No": "Não",
  "Enabled": "Ativado",
  "Disabled": "Desativado",
  "Optional": "Opcional",
  "Required": "Obrigatório",

  // Months
  "Jan": "Jan",
  "Feb": "Fev",
  "Mar": "Mar",
  "Apr": "Abr",
  "May": "Mai",
  "Jun": "Jun",
  "Jul": "Jul",
  "Aug": "Ago",
  "Sep": "Set",
  "Oct": "Out",
  "Nov": "Nov",
  "Dec": "Dez",
  "January": "Janeiro",
  "February": "Fevereiro",
  "March": "Março",
  "April": "Abril",
  "June": "Junho",
  "July": "Julho",
  "August": "Agosto",
  "September": "Setembro",
  "October": "Outubro",
  "November": "Novembro",
  "December": "Dezembro",
};

// Case-insensitive lookup map
const PT_LOWER_MAP = new Map<string, string>();
for (const [enKey, ptVal] of Object.entries(PT_DICTIONARY)) {
  PT_LOWER_MAP.set(enKey.toLowerCase(), ptVal);
}

/**
 * Universal Portuguese translator for arbitrary text strings.
 * Handles exact matches, case-insensitive matches, regex pattern matching,
 * dynamic templates (rent collections, invoice numbers, counts), and preserves whitespace.
 */
export function translateToPortuguese(text: string): string {
  if (!text || typeof text !== "string") return text;

  // Extract leading & trailing whitespace
  const match = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!match) return text;
  const [, leading, core, trailing] = match;
  if (!core) return text;

  // Skip pure numbers, currency, dates, percentages, codes
  if (/^[\d\s,.\-+/%:R$€£NAD]+$/.test(core)) return text;
  if (/^https?:\/\//i.test(core)) return text;
  if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(core)) return text;

  // 1. Direct dictionary match
  if (PT_DICTIONARY[core]) {
    return leading + PT_DICTIONARY[core] + trailing;
  }

  // 2. Case-insensitive dictionary match
  const lowerCore = core.toLowerCase();
  if (PT_LOWER_MAP.has(lowerCore)) {
    return leading + PT_LOWER_MAP.get(lowerCore)! + trailing;
  }

  // 3. Dynamic pattern matchers
  // "Rent collection from [Name]"
  const rentCollMatch = core.match(/^Rent collection from (.+)$/i);
  if (rentCollMatch) {
    return `${leading}Cobrança de renda de ${rentCollMatch[1]}${trailing}`;
  }

  // "Turnover cleaning after checkout of [Name]"
  const cleaningMatch = core.match(/^Turnover cleaning after checkout of (.+)$/i);
  if (cleaningMatch) {
    return `${leading}Limpeza de rotatividade após check-out de ${cleaningMatch[1]}${trailing}`;
  }

  // "Invoice [Number] distribution"
  const invDistMatch = core.match(/^Invoice (INV-[^\s]+) distribution$/i);
  if (invDistMatch) {
    return `${leading}Distribuição da fatura ${invDistMatch[1]}${trailing}`;
  }

  // "Receipt for [X]"
  const receiptMatch = core.match(/^Receipt for (.+)$/i);
  if (receiptMatch) {
    return `${leading}Recibo para ${receiptMatch[1]}${trailing}`;
  }

  // "Payment of [X]" or "Payment for [X]"
  const paymentForMatch = core.match(/^Payment (?:for|of) (.+)$/i);
  if (paymentForMatch) {
    return `${leading}Pagamento para ${paymentForMatch[1]}${trailing}`;
  }

  // "Showing X of Y [items]"
  const showingMatch = core.match(/^Showing (\d+) of (\d+)(.*)$/i);
  if (showingMatch) {
    return `${leading}A mostrar ${showingMatch[1]} de ${showingMatch[2]}${showingMatch[3]}${trailing}`;
  }

  // "X selected"
  const selectedMatch = core.match(/^(\d+) selected$/i);
  if (selectedMatch) {
    return `${leading}${selectedMatch[1]} selecionado(s)${trailing}`;
  }

  // "X listings?"
  const listingCountMatch = core.match(/^(\d+)\s+listings?$/i);
  if (listingCountMatch) {
    return `${leading}${listingCountMatch[1]} imóvei(s)${trailing}`;
  }

  // "X days?"
  const daysMatch = core.match(/^(\d+)\s+days?$/i);
  if (daysMatch) {
    return `${leading}${daysMatch[1]} dia(s)${trailing}`;
  }

  // "X nights?"
  const nightsMatch = core.match(/^(\d+)\s+nights?$/i);
  if (nightsMatch) {
    return `${leading}${nightsMatch[1]} noite(s)${trailing}`;
  }

  // "X months?"
  const monthsMatch = core.match(/^(\d+)\s+months?$/i);
  if (monthsMatch) {
    return `${leading}${monthsMatch[1]} mês(es)${trailing}`;
  }

  // "Search [anything]..."
  const searchMatch = core.match(/^Search (.+)\.\.\.$/i);
  if (searchMatch) {
    return `${leading}Pesquisar ${translateToPortuguese(searchMatch[1])}...${trailing}`;
  }

  // "Filter by [anything]..."
  const filterMatch = core.match(/^Filter by (.+)\.\.\.$/i);
  if (filterMatch) {
    return `${leading}Filtrar por ${translateToPortuguese(filterMatch[1])}...${trailing}`;
  }

  // "Choose [anything]..."
  const chooseMatch = core.match(/^Choose (.+)$/i);
  if (chooseMatch) {
    return `${leading}Escolher ${translateToPortuguese(chooseMatch[1])}${trailing}`;
  }

  return text;
}

/* =========================================================================
   DOM AUTO-TRANSLATOR COMPONENT
   Attaches to #main-content and dialog overlays to automatically translate
   every element, card, table, badge, button, and input to Portuguese.
   Preserves original English text in WeakMaps so switching back restores
   cleanly without page reloading.
   ========================================================================= */

const nodeOrigTextMap = new WeakMap<Node, string>();
const elemOrigPlaceholderMap = new WeakMap<Element, string>();
const elemOrigTitleMap = new WeakMap<Element, string>();

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "SVG", "NOSCRIPT"]);

function shouldSkipElement(el: Element): boolean {
  if (SKIP_TAGS.has(el.tagName)) return true;
  if (el.hasAttribute("data-no-translate")) return true;
  if (el.classList.contains("no-translate")) return true;
  return false;
}

function translateDomTree(root: Element | Document, language: Language) {
  const isPortuguese = language === "pt";

  // 1. Text nodes traversal
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || shouldSkipElement(parent)) return NodeFilter.FILTER_REJECT;
      const val = node.nodeValue || "";
      if (!val.trim()) return NodeFilter.FILTER_SKIP;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let currentNode = walker.nextNode();
  while (currentNode) {
    const rawVal = currentNode.nodeValue || "";
    if (isPortuguese) {
      if (!nodeOrigTextMap.has(currentNode)) {
        nodeOrigTextMap.set(currentNode, rawVal);
      }
      const orig = nodeOrigTextMap.get(currentNode) || rawVal;
      const translated = translateToPortuguese(orig);
      if (translated !== currentNode.nodeValue) {
        currentNode.nodeValue = translated;
      }
    } else {
      if (nodeOrigTextMap.has(currentNode)) {
        const orig = nodeOrigTextMap.get(currentNode)!;
        if (currentNode.nodeValue !== orig) {
          currentNode.nodeValue = orig;
        }
      }
    }
    currentNode = walker.nextNode();
  }

  // 2. Attributes traversal (placeholders & titles)
  const inputs = root.querySelectorAll("input[placeholder], textarea[placeholder]");
  inputs.forEach((el) => {
    const input = el as HTMLInputElement | HTMLTextAreaElement;
    if (shouldSkipElement(input)) return;
    if (isPortuguese) {
      if (!elemOrigPlaceholderMap.has(input)) {
        elemOrigPlaceholderMap.set(input, input.placeholder);
      }
      const orig = elemOrigPlaceholderMap.get(input) || input.placeholder;
      const translated = translateToPortuguese(orig);
      if (translated !== input.placeholder) {
        input.placeholder = translated;
      }
    } else {
      if (elemOrigPlaceholderMap.has(input)) {
        input.placeholder = elemOrigPlaceholderMap.get(input)!;
      }
    }
  });

  const titledElems = root.querySelectorAll("[title]");
  titledElems.forEach((el) => {
    if (shouldSkipElement(el)) return;
    const title = el.getAttribute("title");
    if (!title || !title.trim()) return;
    if (isPortuguese) {
      if (!elemOrigTitleMap.has(el)) {
        elemOrigTitleMap.set(el, title);
      }
      const orig = elemOrigTitleMap.get(el) || title;
      const translated = translateToPortuguese(orig);
      if (translated !== title) {
        el.setAttribute("title", translated);
      }
    } else {
      if (elemOrigTitleMap.has(el)) {
        el.setAttribute("title", elemOrigTitleMap.get(el)!);
      }
    }
  });
}

export function LanguageAutoTranslator({ language }: { language: Language }) {
  const isObservingRef = useRef(false);
  const observerRef = useRef<MutationObserver | null>(null);

  useEffect(() => {
    function processRoots() {
      // Temporarily disconnect observer to avoid infinite loops
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      const mainContent = document.getElementById("main-content");
      if (mainContent) {
        translateDomTree(mainContent, language);
      }

      // Also process dialog overlays and popups rendered in body
      const modals = document.querySelectorAll('[role="dialog"], .fixed');
      modals.forEach((modal) => {
        translateDomTree(modal, language);
      });

      // Re-connect observer only if in Portuguese
      if (language === "pt" && observerRef.current) {
        if (mainContent) {
          observerRef.current.observe(mainContent, {
            childList: true,
            subtree: true,
            characterData: true,
          });
        }
        observerRef.current.observe(document.body, {
          childList: true,
          subtree: false,
        });
      }
    }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    function debouncedProcess() {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        processRoots();
      }, 35);
    }

    observerRef.current = new MutationObserver(() => {
      debouncedProcess();
    });

    // Run initial translation
    processRoots();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [language]);

  return null;
}

/* =========================================================================
   REACT CONTEXT & PROVIDER
   ========================================================================= */

const LanguageContext = createContext<{
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof Translations) => string;
  translate: (text: string) => string;
}>({
  language: "en",
  setLanguage: () => {},
  t: (key) => en[key] || key,
  translate: (text) => text,
});

const STORAGE_KEY = "paimbabook_lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && saved in translations) return saved as Language;
    } catch {}
    return "en";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {}
  };

  const t = (key: keyof Translations): string => {
    return translations[language][key] || translations.en[key] || String(key);
  };

  const translate = (text: string): string => {
    if (language === "pt") {
      return translateToPortuguese(text);
    }
    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, translate }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
