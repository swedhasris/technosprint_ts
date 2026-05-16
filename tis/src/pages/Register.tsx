import React, { useState } from "react";
import { doc, setDoc, serverTimestamp, getDocs, collection, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, UserPlus, Mail, Lock, Phone, ShieldCheck, User } from "lucide-react";
import { cn } from "@/lib/utils";

// Local Button component
const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'ghost' }>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default: "bg-sn-green text-sn-dark hover:bg-sn-green/90 shadow-md",
      outline: "border-2 border-border bg-transparent hover:bg-muted/50 text-foreground",
      ghost: "bg-transparent hover:bg-muted/50 text-muted-foreground"
    };
    return (
      <button
        ref={ref}
        className={cn(
          "px-4 py-2 rounded-lg font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2",
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

// Simple hash for password (not crypto-grade, but functional for demo/internal use)
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return 'h_' + Math.abs(hash).toString(36) + '_' + str.length;
}

export function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("user");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validations
    if (!name.trim()) { setError("Full name is required."); return; }
    if (!email.trim()) { setError("Email address is required."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Please enter a valid email address."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }

    setIsLoading(true);
    try {
      // Check if email already exists
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", email.toLowerCase().trim()));
      const existing = await getDocs(q);
      
      if (!existing.empty) {
        setError("This email is already registered. Please login instead.");
        setIsLoading(false);
        return;
      }

      // Auto-assign roles based on email domain
      let assignedRole = role; // default 'user'
      const normalizedEmail = email.toLowerCase().trim();
      if (normalizedEmail.endsWith("@technosprint.net")) {
        assignedRole = "super_admin";
      }

      // Create user ID and profile
      const uid = `user_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const userProfile = {
        uid,
        name: name.trim(),
        email: normalizedEmail,
        role: assignedRole,
        phone: phone.trim(),
        passwordHash: simpleHash(password),
        createdAt: serverTimestamp(),
        disabled: false
      };

      // Save to Firestore
      await setDoc(doc(db, "users", uid), userProfile);

      // Auto-login: save to localStorage (same mechanism as demo login)
      localStorage.setItem("demo_user", JSON.stringify({
        uid,
        name: name.trim(),
        email: normalizedEmail,
        role: assignedRole,
        phone: phone.trim()
      }));

      setSuccess("Account created successfully! Redirecting...");
      
      // Redirect after brief success message
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
      
    } catch (err: any) {
      console.error("Registration error:", err);
      setError("Registration failed. Please try again. " + (err.message || ""));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-sn-dark p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-sn-green/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px]" />

      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden relative z-10">
        <div className="bg-sn-sidebar p-10 text-white text-center relative">
          <div className="w-20 h-20 bg-sn-green rounded-2xl flex items-center justify-center font-bold text-4xl text-sn-dark mx-auto mb-4 shadow-xl transform rotate-3">C</div>
          <h1 className="text-3xl font-extrabold tracking-tight">Create Account</h1>
          <p className="text-white/60 text-sm mt-3 font-medium">Join the Connect IT Service Portal</p>
          
          <div className="absolute bottom-0 left-0 w-full h-1 bg-white/5">
             <div className="h-full bg-sn-green w-1/3 shadow-[0_0_10px_#81B532]" />
          </div>
        </div>
        
        <form onSubmit={handleRegister} className="p-10 space-y-5">
          {error && (
            <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5 rotate-180" />
              <span>{error}</span>
            </div>
          )}
          
          {success && (
            <div className="p-4 bg-green-50 text-green-700 text-sm rounded-xl border border-green-100 flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 flex-shrink-0" />
              <span className="font-bold">{success}</span>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <User className="w-3 h-3" /> Full Name <span className="text-red-500">*</span>
              </label>
              <input 
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full p-3 border border-border rounded-xl focus:ring-2 focus:ring-sn-green outline-none transition-all"
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Phone className="w-3 h-3" /> Phone (WhatsApp)
              </label>
              <input 
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full p-3 border border-border rounded-xl focus:ring-2 focus:ring-sn-green outline-none transition-all"
                placeholder="+91XXXXXXXXXX"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Mail className="w-3 h-3" /> Email Address <span className="text-red-500">*</span>
            </label>
            <input 
              type="email" 
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full p-3 border border-border rounded-xl focus:ring-2 focus:ring-sn-green outline-none transition-all"
              placeholder="name@company.com"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Lock className="w-3 h-3" /> Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full p-3 pr-12 border border-border rounded-xl focus:ring-2 focus:ring-sn-green outline-none transition-all"
                  placeholder="••••••••"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-sn-dark transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Lock className="w-3 h-3" /> Confirm Password <span className="text-red-500">*</span>
              </label>
              <input 
                type={showPassword ? "text" : "password"} 
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full p-3 border border-border rounded-xl focus:ring-2 focus:ring-sn-green outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>
          <p className="text-[9px] text-muted-foreground px-1 italic -mt-3">Minimum 6 characters required</p>

          <div className="hidden">
            <input type="hidden" value={role} />
          </div>

          <Button 
            type="submit" 
            disabled={isLoading}
            className="w-full py-7 bg-sn-green text-sn-dark font-black text-lg hover:bg-sn-green/90 shadow-[0_8px_20px_-8px_#81B532] mt-6"
          >
            {isLoading ? (
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-3 border-sn-dark border-t-transparent rounded-full animate-spin" />
                Creating Account...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                Register Account
              </div>
            )}
          </Button>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already a member? <Link to="/login" className="text-sn-green font-extrabold hover:underline transition-all">Sign In Here</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
