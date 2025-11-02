import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowUpRight, ArrowDownLeft } from "lucide-react";

const transactions = [
  {
    id: "txn1",
    date: "Jul 29, 2024",
    type: "Receive",
    amount: "+ 1.2000 ETH",
    address: "0x1a2bc3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
  },
  {
    id: "txn2",
    date: "Jul 28, 2024",
    type: "Send",
    amount: "- 0.5000 ETH",
    address: "0x5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x",
  },
  {
    id: "txn3",
    date: "Jul 27, 2024",
    type: "Receive",
    amount: "+ 3.0000 ETH",
    address: "0x9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b",
  },
  {
    id: "txn4",
    date: "Jul 25, 2024",
    type: "Send",
    amount: "- 2.1500 ETH",
    address: "0x3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f",
  },
];

export default function TransactionsTab() {
  return (
    <Card className="mt-6 shadow-lg border-none">
      <CardHeader>
        <CardTitle>Transaction History</CardTitle>
        <CardDescription>A record of your recent transactions.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Details</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell>
                  <div className="flex items-center gap-4">
                    {transaction.type === "Send" ? (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                        <ArrowUpRight className="h-5 w-5 text-destructive" />
                      </span>
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <ArrowDownLeft className="h-5 w-5 text-primary" />
                      </span>
                    )}
                    <div className="grid gap-0.5">
                      <p className="font-semibold">{transaction.type}</p>
                      <p className="text-sm text-muted-foreground font-mono">
                        {transaction.type === 'Send' ? 'To: ' : 'From: '}
                        <span className="hidden sm:inline">{transaction.address.slice(0,15)}...</span>
                        <span className="sm:hidden">{transaction.address.slice(0, 10)}...</span>
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <p className={`font-bold ${transaction.type === 'Send' ? '' : 'text-primary'}`}>{transaction.amount}</p>
                  <p className="text-sm text-muted-foreground">{transaction.date}</p>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  );
}
