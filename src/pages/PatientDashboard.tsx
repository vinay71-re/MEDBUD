import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  Calendar, 
  Clock, 
  FileText, 
  LogOut, 
  User, 
  Bot, 
  ChevronRight,
  Stethoscope,
  Bell
} from "lucide-react";
import { Session } from "@supabase/supabase-js";
import AIHealthAssistant from "@/components/AIHealthAssistant";

const PatientDashboard = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [tokens, setTokens] = useState<any[]>([]);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      } else {
        fetchUserData(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      } else {
        fetchUserData(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Fetch user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (rolesError) throw rolesError;
      setUserRoles(rolesData.map((r) => r.role));

      // Fetch upcoming appointments
      const { data: appointmentsData } = await supabase
        .from("appointments")
        .select(`
          *,
          doctors:doctor_id (
            specialization,
            profiles:user_id (full_name)
          )
        `)
        .eq("patient_id", userId)
        .gte("appointment_date", new Date().toISOString().split("T")[0])
        .order("appointment_date", { ascending: true })
        .limit(5);

      if (appointmentsData) {
        const transformedAppointments = appointmentsData.map((apt) => ({
          ...apt,
          doctors: {
            ...apt.doctors,
            profiles: Array.isArray(apt.doctors?.profiles) 
              ? apt.doctors.profiles[0] 
              : apt.doctors?.profiles
          }
        }));
        setAppointments(transformedAppointments);
      }

      // Fetch active tokens
      const { data: tokensData } = await supabase
        .from("tokens")
        .select(`
          *,
          doctors:doctor_id (
            specialization,
            profiles:user_id (full_name)
          )
        `)
        .eq("patient_id", userId)
        .eq("status", "waiting")
        .order("token_date", { ascending: true })
        .limit(5);

      if (tokensData) {
        const transformedTokens = tokensData.map((token) => ({
          ...token,
          doctors: {
            ...token.doctors,
            profiles: Array.isArray(token.doctors?.profiles) 
              ? token.doctors.profiles[0] 
              : token.doctors?.profiles
          }
        }));
        setTokens(transformedTokens);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error",
        description: "Failed to logout. Please try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Logged out",
        description: "You have been logged out successfully.",
      });
      navigate("/");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center">
                <Stethoscope className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Patient Dashboard</h1>
                <p className="text-xs text-muted-foreground">Welcome back!</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5" />
                {tokens.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
                )}
              </Button>
              <Button onClick={handleLogout} variant="ghost" size="sm">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - User Info & Quick Actions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-xl shadow-soft p-6 border border-border"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center">
                  <User className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-foreground">
                    {profile?.full_name || "Patient"}
                  </h2>
                  <p className="text-muted-foreground text-sm">{session?.user.email}</p>
                  <div className="flex gap-2 mt-2">
                    {userRoles.map((role) => (
                      <span
                        key={role}
                        className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary capitalize"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
                <Button 
                  onClick={() => setShowAIAssistant(!showAIAssistant)}
                  className="hidden md:flex"
                  variant={showAIAssistant ? "secondary" : "default"}
                >
                  <Bot className="w-4 h-4 mr-2" />
                  AI Assistant
                </Button>
              </div>
            </motion.div>

            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4"
            >
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col gap-2"
                onClick={() => navigate("/book-appointment")}
              >
                <Calendar className="w-6 h-6 text-primary" />
                <span className="text-xs">Book Appointment</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col gap-2"
                onClick={() => setShowAIAssistant(true)}
              >
                <Bot className="w-6 h-6 text-primary" />
                <span className="text-xs">AI Health Help</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col gap-2"
              >
                <FileText className="w-6 h-6 text-primary" />
                <span className="text-xs">My Records</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col gap-2"
              >
                <Clock className="w-6 h-6 text-primary" />
                <span className="text-xs">Token Status</span>
              </Button>
            </motion.div>

            {/* Upcoming Appointments */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-card rounded-xl shadow-soft border border-border overflow-hidden"
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  Upcoming Appointments
                </h3>
                <Button variant="ghost" size="sm">
                  View All <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              <div className="divide-y divide-border">
                {appointments.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">
                    <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>No upcoming appointments</p>
                    <Button 
                      variant="link" 
                      className="mt-2"
                      onClick={() => navigate("/book-appointment")}
                    >
                      Book your first appointment
                    </Button>
                  </div>
                ) : (
                  appointments.map((apt) => (
                    <div key={apt.id} className="p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">
                            Dr. {apt.doctors?.profiles?.full_name || "Unknown"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {apt.doctors?.specialization}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-foreground">
                            {new Date(apt.appointment_date).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-muted-foreground">{apt.appointment_time}</p>
                        </div>
                      </div>
                      <span className={`inline-block mt-2 px-2 py-0.5 text-xs rounded-full ${
                        apt.status === "confirmed" 
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                      }`}>
                        {apt.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </motion.div>

            {/* Active Tokens */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-card rounded-xl shadow-soft border border-border overflow-hidden"
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Active Tokens
                </h3>
              </div>
              <div className="divide-y divide-border">
                {tokens.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">
                    <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>No active tokens</p>
                  </div>
                ) : (
                  tokens.map((token) => (
                    <div key={token.id} className="p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">
                            Token #{token.token_number}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Dr. {token.doctors?.profiles?.full_name || "Unknown"} - {token.doctors?.specialization}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                            {token.status}
                          </span>
                          {token.estimated_time && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Est. {new Date(token.estimated_time).toLocaleTimeString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>

          {/* Right Column - AI Assistant */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className={`${showAIAssistant ? "block" : "hidden lg:block"} lg:sticky lg:top-24 h-[calc(100vh-120px)]`}
          >
            <AIHealthAssistant />
          </motion.div>
        </div>

        {/* Mobile AI Assistant Toggle */}
        <div className="fixed bottom-6 right-6 lg:hidden">
          <Button
            onClick={() => setShowAIAssistant(!showAIAssistant)}
            size="lg"
            className="rounded-full w-14 h-14 shadow-lg"
          >
            <Bot className="w-6 h-6" />
          </Button>
        </div>

        {/* Mobile AI Assistant Modal */}
        {showAIAssistant && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div 
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setShowAIAssistant(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="absolute bottom-0 left-0 right-0 h-[80vh] bg-card rounded-t-2xl overflow-hidden"
            >
              <AIHealthAssistant />
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientDashboard;
