import React from "react";
import { 
  Search, 
  Ticket, 
  ShoppingCart, 
  BookOpen, 
  MessageSquare, 
  Clock, 
  ChevronRight,
  PlusCircle
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTickets } from "../contexts/TicketsContext";
import { cn } from "@/lib/utils";

export function ServicePortal() {
  const { profile, user } = useAuth();
  const { tickets } = useTickets();
  const navigate = useNavigate();

  // Filter for my active items (where I am caller or created by me, and not closed)
  const myActiveTickets = tickets.filter(t => 
    (t.caller === user?.email || t.caller === profile?.name || t.createdBy === user?.uid) &&
    !["Resolved", "Closed", "Canceled"].includes(t.status)
  ).slice(0, 5); // show top 5

  const PORTAL_ACTIONS = [
    { icon: PlusCircle, title: "Report an Issue", description: "Something is broken or not working as expected.", path: "/tickets?action=new", color: "text-red-600", bg: "bg-red-50" },
    { icon: ShoppingCart, title: "Request Something", description: "Order hardware, software, or access permissions.", path: "/catalog", color: "text-sn-green", bg: "bg-sn-green/10" },
    { icon: BookOpen, title: "Knowledge Base", description: "Find answers and troubleshooting guides.", path: "/kb", color: "text-blue-600", bg: "bg-blue-50" },
    { icon: MessageSquare, title: "Get Help", description: "Chat with an agent or search our FAQs.", path: "/kb", color: "text-purple-600", bg: "bg-purple-50" },
  ];

  return (
    <div className="space-y-12 max-w-6xl mx-auto pb-12">
      {/* Hero Section */}
      <div className="text-center space-y-6 py-16">
        <h1 className="text-5xl font-light text-sn-dark">How can we help you, {profile?.name?.split(' ')[0] || 'User'}?</h1>
        <div className="max-w-2xl mx-auto relative group">
          <Search className="w-6 h-6 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-sn-green transition-colors" />
          <input 
            type="text"
            placeholder="Search for services, articles, or tickets..."
            className="w-full bg-white border border-border rounded-2xl py-5 pl-14 pr-6 text-xl outline-none shadow-xl focus:ring-2 focus:ring-sn-green transition-all"
          />
        </div>
      </div>

      {/* Main Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {PORTAL_ACTIONS.map((action) => (
          <Link 
            key={action.title} 
            to={action.path}
            className="sn-card p-6 hover:border-sn-green transition-all group flex flex-col items-center text-center space-y-4"
          >
            <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", action.bg)}>
              <action.icon className={cn("w-8 h-8", action.color)} />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sn-dark">{action.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{action.description}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* My Active Items */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-sn-dark">My Active Items</h2>
            <Button variant="ghost" size="sm" className="text-sn-green font-bold" onClick={() => navigate('/tickets?filter=assigned_to_me')}>View All</Button>
          </div>
          <div className="sn-card p-0 overflow-hidden divide-y divide-border">
            {myActiveTickets.length > 0 ? (
              myActiveTickets.map((item: any) => (
                <div 
                  key={item.id} 
                  className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors cursor-pointer group"
                  onClick={() => navigate(`/tickets/${item.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                      <Ticket className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-sn-dark group-hover:text-sn-green transition-colors">{item.title}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">{item.number || item.id} • {new Date(item.createdAt?.seconds * 1000 || item.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                      item.status === 'New' ? "bg-blue-50 text-blue-600" :
                      item.status === 'In Progress' ? "bg-sn-green/10 text-sn-green" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {item.status}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-muted-foreground text-sm">
                You have no active items at the moment.
              </div>
            )}
          </div>
        </div>

        {/* Popular Articles */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-sn-dark">Popular Articles</h2>
          <div className="sn-card p-4 space-y-4">
            {[
              "Resetting your corporate password",
              "Connecting to office Wi-Fi",
              "Remote work best practices",
              "Requesting software licenses"
            ].map((article) => (
              <Link key={article} to="/kb" className="block text-sm text-sn-dark hover:text-sn-green transition-colors flex items-center justify-between group">
                <span className="truncate pr-4">{article}</span>
                <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </Link>
            ))}
          </div>
          <div className="sn-card bg-sn-sidebar text-white p-6 space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-sn-green/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <h3 className="font-bold relative z-10">Need more help?</h3>
            <p className="text-xs text-white/60 relative z-10">Our support team is available 24/7 to assist you with any technical issues.</p>
            <Button className="w-full bg-sn-green text-sn-dark font-bold relative z-10">Contact Support</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}
