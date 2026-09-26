import React from "react";
import { Link } from "react-router-dom";
import { Modal } from "@/components/modal";
import {
  AlertCircle,
  Clock,
  Wrench,
  Truck,
  Brush,
  DollarSign,
  BedDouble,
  FileSignature,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

interface PendingActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingMaintenance: number;
  awaitingProcurement: number;
  quotationProcurement: number;
  cleaningNeededRooms: number;
  pendingBillsCount?: number;
}

export function PendingActionsModal({
  isOpen,
  onClose,
  pendingMaintenance,
  awaitingProcurement,
  quotationProcurement,
  cleaningNeededRooms,
  pendingBillsCount = 0,
}: PendingActionsModalProps) {
  const totalPending =
    pendingMaintenance +
    awaitingProcurement +
    quotationProcurement +
    cleaningNeededRooms +
    pendingBillsCount;

  return (
    <Modal open={isOpen} onClose={onClose} title="Pending Actions & Operational Backlog">
      <div className="space-y-4 text-foreground">
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
          <AlertCircle size={20} className="shrink-0 text-amber-600" />
          <p>
            You have <strong>{totalPending} operational tasks</strong> awaiting review, approval,
            or execution across departments.
          </p>
        </div>

        <div className="divide-y divide-border-color border border-border-color rounded-xl overflow-hidden bg-surface">
          {/* Work Orders */}
          <div className="p-4 flex items-center justify-between gap-3 hover:bg-surface-elevated/40 transition">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600">
                <Wrench size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold">Maintenance Work Orders</h4>
                <p className="text-xs text-muted">
                  {pendingMaintenance} repair ticket(s) currently open or in-progress.
                </p>
              </div>
            </div>
            <Link
              to="/maintenance/work-orders"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated border border-border-color text-xs font-semibold hover:bg-blue-600 hover:text-white transition"
            >
              <span>View Queue</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          {/* Procurement Funds */}
          <div className="p-4 flex items-center justify-between gap-3 hover:bg-surface-elevated/40 transition">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-600">
                <Truck size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold">Procurement Approvals & RFQs</h4>
                <p className="text-xs text-muted">
                  {awaitingProcurement} awaiting finance funds • {quotationProcurement} in quote gathering.
                </p>
              </div>
            </div>
            <Link
              to="/procurement"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated border border-border-color text-xs font-semibold hover:bg-purple-600 hover:text-white transition"
            >
              <span>Procurement Pipeline</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          {/* Housekeeping */}
          <div className="p-4 flex items-center justify-between gap-3 hover:bg-surface-elevated/40 transition">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-teal-500/10 text-teal-600">
                <Brush size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold">Housekeeping & Room Turnovers</h4>
                <p className="text-xs text-muted">
                  {cleaningNeededRooms} room(s) flagged for housekeeping & cleaning turnover.
                </p>
              </div>
            </div>
            <Link
              to="/commercial-bookings"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated border border-border-color text-xs font-semibold hover:bg-teal-600 hover:text-white transition"
            >
              <span>Manage Rooms</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          {/* Pending Bills */}
          <div className="p-4 flex items-center justify-between gap-3 hover:bg-surface-elevated/40 transition">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-600">
                <DollarSign size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold">Pending Utility & Vendor Bills</h4>
                <p className="text-xs text-muted">
                  {pendingBillsCount} scheduled bills awaiting payment confirmation or POP upload.
                </p>
              </div>
            </div>
            <Link
              to="/bills"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated border border-border-color text-xs font-semibold hover:bg-rose-600 hover:text-white transition"
            >
              <span>Review Bills</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-xl border border-border-color bg-surface-elevated text-foreground hover:bg-surface transition"
          >
            Close Backlog
          </button>
        </div>
      </div>
    </Modal>
  );
}

interface DueItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCheckins: number;
  pendingBillsCount?: number;
}

export function DueItemsModal({
  isOpen,
  onClose,
  activeCheckins,
  pendingBillsCount = 0,
}: DueItemsModalProps) {
  return (
    <Modal open={isOpen} onClose={onClose} title="Due Items & Deadlines Command Hub">
      <div className="space-y-4 text-foreground">
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300">
          <Clock size={20} className="shrink-0 text-blue-600" />
          <p>
            Monitor live checkout countdowns, upcoming scheduled bills, and contract renewal deadlines.
          </p>
        </div>

        <div className="divide-y divide-border-color border border-border-color rounded-xl overflow-hidden bg-surface">
          {/* Guest Departures / Checkouts Due */}
          <div className="p-4 flex items-center justify-between gap-3 hover:bg-surface-elevated/40 transition">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600">
                <BedDouble size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold">Express Checkout & Overstay Desk</h4>
                <p className="text-xs text-muted">
                  {activeCheckins} active guest(s) in-house with live countdown stay timers.
                </p>
              </div>
            </div>
            <Link
              to="/commercial-bookings"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition"
            >
              <span>Express Checkout</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          {/* Bills Due */}
          <div className="p-4 flex items-center justify-between gap-3 hover:bg-surface-elevated/40 transition">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-600">
                <DollarSign size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold">Scheduled Bills Due</h4>
                <p className="text-xs text-muted">
                  {pendingBillsCount} payment commitments due this billing cycle.
                </p>
              </div>
            </div>
            <Link
              to="/bills"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated border border-border-color text-xs font-semibold hover:bg-rose-600 hover:text-white transition"
            >
              <span>Bills Desk</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          {/* Contracts Due */}
          <div className="p-4 flex items-center justify-between gap-3 hover:bg-surface-elevated/40 transition">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                <FileSignature size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold">Lease Expiries & Renewals</h4>
                <p className="text-xs text-muted">
                  Review contracts ending soon, renewal agreements, and notice period tenants.
                </p>
              </div>
            </div>
            <Link
              to="/contracts"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated border border-border-color text-xs font-semibold hover:bg-emerald-600 hover:text-white transition"
            >
              <span>Contracts List</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-xl border border-border-color bg-surface-elevated text-foreground hover:bg-surface transition"
          >
            Close Deadlines
          </button>
        </div>
      </div>
    </Modal>
  );
}
