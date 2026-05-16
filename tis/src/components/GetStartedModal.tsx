"use client"

import * as React from "react"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowRight, CheckCircle2 } from "lucide-react"

interface GetStartedModalProps {
  trigger: React.ReactNode
}

export function GetStartedModal({ trigger }: GetStartedModalProps) {
  const [isSubmitted, setIsSubmitted] = React.useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitted(true)
  }

  return (
    <Dialog onOpenChange={(open) => !open && setIsSubmitted(false)}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-[500px]">
        {!isSubmitted ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl">Get started with Connect</DialogTitle>
              <DialogDescription>
                Experience the power of the intelligent platform for end-to-end digital transformation.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="mt-6 space-y-6">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="email" className="text-white">Work Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="name@company.com" 
                    required 
                    className="border-white/10 bg-white/5 text-white placeholder:text-text-dim focus:border-sn-green focus:ring-sn-green"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="first-name" className="text-white">First Name</Label>
                    <Input 
                      id="first-name" 
                      placeholder="Jane" 
                      required 
                      className="border-white/10 bg-white/5 text-white placeholder:text-text-dim focus:border-sn-green focus:ring-sn-green"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="last-name" className="text-white">Last Name</Label>
                    <Input 
                      id="last-name" 
                      placeholder="Doe" 
                      required 
                      className="border-white/10 bg-white/5 text-white placeholder:text-text-dim focus:border-sn-green focus:ring-sn-green"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="company" className="text-white">Company Name</Label>
                  <Input 
                    id="company" 
                    placeholder="Acme Inc." 
                    required 
                    className="border-white/10 bg-white/5 text-white placeholder:text-text-dim focus:border-sn-green focus:ring-sn-green"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full bg-sn-green font-bold text-sn-dark hover:bg-sn-green/90">
                Contact Sales <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <p className="text-center text-xs text-text-dim">
                By clicking "Contact Sales", you agree to our Terms of Service and Privacy Policy.
              </p>
            </form>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-sn-green/20">
              <CheckCircle2 className="h-10 w-10 text-sn-green" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-white">Thank you!</h2>
            <p className="mb-8 text-text-dim">
              We've received your request. A Connect expert will contact you shortly.
            </p>
            <Button 
              onClick={() => setIsSubmitted(false)}
              className="bg-white/10 text-white hover:bg-white/20"
            >
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
