import { Button } from "@/components/ui/button";
import { motion } from "motion/react";
import { GetStartedModal } from "@/src/components/GetStartedModal";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-sn-dark py-24 text-white lg:py-32">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="z-10 flex flex-col gap-4"
          >
            <span className="text-[11px] font-bold uppercase tracking-[1px] text-sn-green">
              Now Platform Vancouver Release
            </span>
            <h1 className="text-5xl font-bold leading-[1.1] tracking-tight lg:text-[56px]">
              The world works with Connect.
            </h1>
            <p className="max-w-xl text-lg leading-[1.6] text-text-dim lg:text-[18px]">
              The intelligent platform for digital transformation. Automate processes, unify data, and create better experiences for employees and customers.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <GetStartedModal trigger={
                <Button size="lg" className="bg-sn-green px-8 font-semibold text-sn-dark hover:bg-sn-green/90">
                  Get Started
                </Button>
              } />
              <Button size="lg" variant="outline" className="border-white font-semibold text-white hover:bg-white hover:text-sn-dark">
                View solutions
              </Button>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            {/* Bento-like image container */}
            <div className="relative h-[480px] w-full overflow-hidden rounded-[12px] border border-white/10 bg-white/5 p-1">
              <img
                src="https://picsum.photos/seed/vancouver/1200/800"
                alt="Connect Platform"
                className="h-full w-full rounded-[8px] object-cover opacity-60"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-sn-dark via-transparent to-transparent" />
              
              {/* Floating UI elements to mimic bento feel */}
              <div className="absolute top-8 left-8 rounded-lg border border-white/10 bg-white/10 p-4 backdrop-blur-md">
                <div className="mb-2 h-2 w-12 rounded-full bg-sn-green" />
                <div className="h-2 w-24 rounded-full bg-white/20" />
              </div>
              <div className="absolute bottom-8 right-8 rounded-lg border border-white/10 bg-white/10 p-4 backdrop-blur-md">
                <div className="flex gap-2">
                  <div className="h-8 w-8 rounded-full bg-sn-green/20" />
                  <div className="space-y-2">
                    <div className="h-2 w-16 rounded-full bg-white/40" />
                    <div className="h-2 w-12 rounded-full bg-white/20" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
      
      {/* Background pattern */}
      <div className="absolute inset-0 z-0 opacity-5">
        <div className="absolute h-full w-full bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:40px_40px]" />
      </div>
    </section>
  );
}

