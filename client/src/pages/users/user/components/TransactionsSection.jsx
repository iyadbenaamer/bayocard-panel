import React from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "components/Table";

const TransactionsSection = ({
  transactionColumns,
  transactions,
  isLoading,
  isLoadingMore,
  error,
  hasMore,
  loadMoreRef,
  formatTransactionType,
  formatAmount,
  formatArabicDateTime,
  safeValue,
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="text-sm font-semibold text-slate-700">سجل المعاملات</h2>
        <p className="mt-1 text-xs text-slate-600">
          أحدث العمليات المرتبطة بالمستخدم
        </p>
      </div>
    </div>

    {isLoading && transactions.length === 0 ? (
      <div className="mt-4 rounded-xl border border-slate-200 bg-white/80 px-4 py-6 text-center text-sm text-slate-600">
        جاري تحميل سجل المعاملات...
      </div>
    ) : transactions.length === 0 ? (
      <div className="mt-4 rounded-xl border border-slate-200 bg-white/80 px-4 py-6 text-center text-sm text-slate-600">
        لا توجد معاملات لهذا المستخدم حتى الآن.
      </div>
    ) : (
      <div className="mt-4">
        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}
        <Table columns={transactionColumns}>
          <TableHead columns={transactionColumns} />
          <TableBody>
            {transactions.map((transaction) => (
              <TableRow key={transaction._id}>
                <TableCell>{formatTransactionType(transaction.type)}</TableCell>
                <TableCell>{formatAmount(transaction.amount)}</TableCell>
                <TableCell>{formatAmount(transaction.balanceBefore)}</TableCell>
                <TableCell>{formatAmount(transaction.balanceAfter)}</TableCell>
                <TableCell>
                  {transaction.createdAt
                    ? formatArabicDateTime(transaction.createdAt)
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div ref={loadMoreRef} className="h-12">
          {isLoadingMore ? (
            <div className="py-4 text-center text-xs text-slate-600">
              جاري تحميل المزيد...
            </div>
          ) : hasMore ? (
            <div className="py-4 text-center text-xs text-slate-600">
              مرر لأسفل لتحميل المزيد
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-slate-600">
              تم عرض جميع المعاملات
            </div>
          )}
        </div>
      </div>
    )}
  </div>
);

export default TransactionsSection;
