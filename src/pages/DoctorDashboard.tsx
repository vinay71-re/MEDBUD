import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Calendar, 
  Clock, 
  FileText, 
  LogOut, 
  User, 
  Users,
  Stethoscope,
  Bell,
  ChevronRight,
  CheckCircle,
  XCircle,
  PlayCircle,
  Search,
  ArrowLeft,
  Save
} from "lucide-react";
import { Session } from "@supabase/supabase-js";
import { ScrollArea } from "@/components/ui/scroll-area";

type ViewMode = "dashboard" | "tokens" | "patients" | "records" | "patient-detail";

const DoctorDashboard = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [doctorInfo, setDoctorInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [tokens, setTokens] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [patientRecords, setPatientRecords] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [todayStats, setTodayStats] = useState({ total: 0, completed: 0, waiting: 0 });
  
  // For creating/editing records
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [recordForm, setRecordForm] = useState({
    diagnosis: "",
    prescription: "",
    notes: ""
  });

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      } else {
        fetchDoctorData(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchDoctorData = async (userId: string) => {
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      setProfile(profileData);

      // Fetch doctor info
      const { data: doctorData } = await supabase
        .from("doctors")
        .select("*")
        .eq("user_id", userId)
        .single();
      
      if (!doctorData) {
        toast({
          title: "Access Denied",
          description: "You are not registered as a doctor.",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }
      setDoctorInfo(doctorData);

      // Fetch today's tokens
      const today = new Date().toISOString().split("T")[0];
      const { data: tokensData } = await supabase
        .from("tokens")
        .select(`
          *,
          profiles:patient_id (full_name, phone)
        `)
        .eq("doctor_id", doctorData.id)
        .eq("token_date", today)
        .order("token_number", { ascending: true });

      if (tokensData) {
        setTokens(tokensData);
        const completed = tokensData.filter(t => t.status === "completed").length;
        const waiting = tokensData.filter(t => t.status === "waiting").length;
        setTodayStats({ total: tokensData.length, completed, waiting });
      }

      // Fetch today's appointments
      const { data: appointmentsData } = await supabase
        .from("appointments")
        .select("*")
        .eq("doctor_id", doctorData.id)
        .eq("appointment_date", today)
        .order("appointment_time", { ascending: true });

      if (appointmentsData) setAppointments(appointmentsData);

      // Fetch patients with records
      const { data: recordsData } = await supabase
        .from("patient_records")
        .select(`
          *,
          profiles:patient_id (id, full_name, phone),
          tokens:token_id (token_number, token_date)
        `)
        .eq("doctor_id", doctorData.id)
        .order("created_at", { ascending: false });

      if (recordsData) {
        setPatientRecords(recordsData);
        // Get unique patients
        const uniquePatients = new Map();
        recordsData.forEach(record => {
          if (record.profiles && !uniquePatients.has(record.profiles.id)) {
            uniquePatients.set(record.profiles.id, record.profiles);
          }
        });
        setPatients(Array.from(uniquePatients.values()));
      }

    } catch (error) {
      console.error("Error fetching doctor data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTokenStatusChange = async (tokenId: string, newStatus: string) => {
    const { error } = await supabase
      .from("tokens")
      .update({ status: newStatus })
      .eq("id", tokenId);

    if (error) {
      toast({ title: "Error", description: "Failed to update token status", variant: "destructive" });
    } else {
      toast({ title: "Success", description: `Token marked as ${newStatus}` });
      if (doctorInfo) {
        const today = new Date().toISOString().split("T")[0];
        const { data: tokensData } = await supabase
          .from("tokens")
          .select(`*, profiles:patient_id (full_name, phone)`)
          .eq("doctor_id", doctorInfo.id)
          .eq("token_date", today)
          .order("token_number", { ascending: true });
        
        if (tokensData) {
          setTokens(tokensData);
          const completed = tokensData.filter(t => t.status === "completed").length;
          const waiting = tokensData.filter(t => t.status === "waiting").length;
          setTodayStats({ total: tokensData.length, completed, waiting });
        }
      }
    }
  };

  const handleSaveRecord = async () => {
    if (!selectedPatient || !doctorInfo) return;

    // Find the latest token for this patient
    const latestToken = tokens.find(t => t.patient_id === selectedPatient.id && t.status === "in_progress");
    
    if (!latestToken) {
      toast({ title: "Error", description: "No active token found for this patient", variant: "destructive" });
      return;
    }

    const recordData = {
      patient_id: selectedPatient.id,
      doctor_id: doctorInfo.id,
      token_id: latestToken.id,
      diagnosis: recordForm.diagnosis,
      prescription: recordForm.prescription,
      notes: recordForm.notes,
    };

    const { error } = await supabase
      .from("patient_records")
      .insert(recordData);

    if (error) {
      toast({ title: "Error", description: "Failed to save record", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Patient record saved" });
      setRecordForm({ diagnosis: "", prescription: "", notes: "" });
      // Mark token as completed
      await handleTokenStatusChange(latestToken.id, "completed");
      setViewMode("tokens");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const filteredPatients = patients.filter(p => 
    p.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.phone?.includes(searchQuery)
  );

  const getPatientRecords = (patientId: string) => {
    return patientRecords.filter(r => r.patient_id === patientId);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading dashboard...</p>
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
              {viewMode !== "dashboard" && (
                <Button variant="ghost" size="icon" onClick={() => setViewMode("dashboard")}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              )}
              <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center">
                <Stethoscope className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Doctor Dashboard</h1>
                <p className="text-xs text-muted-foreground">Dr. {profile?.full_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5" />
                {todayStats.waiting > 0 && (
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
        <AnimatePresence mode="wait">
          {/* Dashboard View */}
          {viewMode === "dashboard" && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-card rounded-xl p-4 border border-border text-center">
                  <p className="text-3xl font-bold text-foreground">{todayStats.total}</p>
                  <p className="text-sm text-muted-foreground">Today's Tokens</p>
                </div>
                <div className="bg-card rounded-xl p-4 border border-border text-center">
                  <p className="text-3xl font-bold text-green-500">{todayStats.completed}</p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
                <div className="bg-card rounded-xl p-4 border border-border text-center">
                  <p className="text-3xl font-bold text-yellow-500">{todayStats.waiting}</p>
                  <p className="text-sm text-muted-foreground">Waiting</p>
                </div>
              </div>

              {/* Feature Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  onClick={() => setViewMode("tokens")}
                  className="bg-card rounded-xl shadow-soft p-6 border border-border cursor-pointer group"
                >
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <Clock className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Token Queue</h3>
                  <p className="text-muted-foreground text-sm mb-4">Manage today's patient queue and call next patient</p>
                  <div className="flex items-center text-primary text-sm font-medium">
                    {todayStats.waiting} waiting <ChevronRight className="w-4 h-4 ml-1" />
                  </div>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.02 }}
                  onClick={() => setViewMode("patients")}
                  className="bg-card rounded-xl shadow-soft p-6 border border-border cursor-pointer group"
                >
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <Users className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Patient Records</h3>
                  <p className="text-muted-foreground text-sm mb-4">View and manage patient medical history</p>
                  <div className="flex items-center text-primary text-sm font-medium">
                    {patients.length} patients <ChevronRight className="w-4 h-4 ml-1" />
                  </div>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="bg-card rounded-xl shadow-soft p-6 border border-border cursor-pointer group"
                >
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <Calendar className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Appointments</h3>
                  <p className="text-muted-foreground text-sm mb-4">View scheduled appointments</p>
                  <div className="flex items-center text-primary text-sm font-medium">
                    {appointments.length} today <ChevronRight className="w-4 h-4 ml-1" />
                  </div>
                </motion.div>
              </div>

              {/* Quick Token List */}
              <div className="bg-card rounded-xl shadow-soft border border-border overflow-hidden">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">Current Queue</h3>
                  <Button variant="ghost" size="sm" onClick={() => setViewMode("tokens")}>
                    View All <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
                <ScrollArea className="h-64">
                  {tokens.filter(t => t.status !== "completed").slice(0, 5).map((token) => (
                    <div key={token.id} className="p-4 border-b border-border last:border-0 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                          token.status === "in_progress" 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {token.token_number}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{token.profiles?.full_name || "Walk-in"}</p>
                          <p className="text-xs text-muted-foreground">{token.profiles?.phone || "No phone"}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        token.status === "in_progress" 
                          ? "bg-primary/10 text-primary"
                          : token.status === "waiting"
                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                          : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      }`}>
                        {token.status}
                      </span>
                    </div>
                  ))}
                  {tokens.filter(t => t.status !== "completed").length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                      <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p>No patients in queue</p>
                    </div>
                  )}
                </ScrollArea>
              </div>
            </motion.div>
          )}

          {/* Token Queue View */}
          {viewMode === "tokens" && (
            <motion.div
              key="tokens"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h2 className="text-2xl font-bold text-foreground">Token Queue Management</h2>
              <p className="text-muted-foreground">Manage today's patient queue</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Waiting */}
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  <div className="p-4 border-b border-border bg-yellow-50 dark:bg-yellow-900/20">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <Clock className="w-5 h-5 text-yellow-600" />
                      Waiting ({tokens.filter(t => t.status === "waiting").length})
                    </h3>
                  </div>
                  <ScrollArea className="h-96">
                    {tokens.filter(t => t.status === "waiting").map((token) => (
                      <div key={token.id} className="p-4 border-b border-border last:border-0">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center font-bold text-yellow-700 dark:text-yellow-400">
                              {token.token_number}
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{token.profiles?.full_name || "Walk-in Patient"}</p>
                              <p className="text-xs text-muted-foreground">{token.profiles?.phone || "No phone"}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            className="flex-1"
                            onClick={() => handleTokenStatusChange(token.id, "in_progress")}
                          >
                            <PlayCircle className="w-4 h-4 mr-1" /> Call Now
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleTokenStatusChange(token.id, "cancelled")}
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {tokens.filter(t => t.status === "waiting").length === 0 && (
                      <div className="p-8 text-center text-muted-foreground">
                        <p>No patients waiting</p>
                      </div>
                    )}
                  </ScrollArea>
                </div>

                {/* In Progress */}
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  <div className="p-4 border-b border-border bg-primary/10">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <User className="w-5 h-5 text-primary" />
                      In Progress ({tokens.filter(t => t.status === "in_progress").length})
                    </h3>
                  </div>
                  <ScrollArea className="h-96">
                    {tokens.filter(t => t.status === "in_progress").map((token) => (
                      <div key={token.id} className="p-4 border-b border-border last:border-0">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center font-bold text-primary-foreground">
                              {token.token_number}
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{token.profiles?.full_name || "Walk-in Patient"}</p>
                              <p className="text-xs text-muted-foreground">{token.profiles?.phone || "No phone"}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                              setSelectedPatient(token.profiles);
                              setViewMode("records");
                            }}
                          >
                            <FileText className="w-4 h-4 mr-1" /> Add Record
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => handleTokenStatusChange(token.id, "completed")}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" /> Complete
                          </Button>
                        </div>
                      </div>
                    ))}
                    {tokens.filter(t => t.status === "in_progress").length === 0 && (
                      <div className="p-8 text-center text-muted-foreground">
                        <p>No patient currently being seen</p>
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>

              {/* Completed Today */}
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="p-4 border-b border-border bg-green-50 dark:bg-green-900/20">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    Completed Today ({tokens.filter(t => t.status === "completed").length})
                  </h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 p-4">
                  {tokens.filter(t => t.status === "completed").map((token) => (
                    <div key={token.id} className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-center">
                      <p className="font-bold text-green-700 dark:text-green-400">#{token.token_number}</p>
                      <p className="text-xs text-muted-foreground truncate">{token.profiles?.full_name || "Walk-in"}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Patients List View */}
          {viewMode === "patients" && (
            <motion.div
              key="patients"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h2 className="text-2xl font-bold text-foreground">Patient Records</h2>
              <p className="text-muted-foreground">Search and view patient medical history</p>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Search by name or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPatients.map((patient) => {
                  const records = getPatientRecords(patient.id);
                  return (
                    <motion.div
                      key={patient.id}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => {
                        setSelectedPatient(patient);
                        setViewMode("patient-detail");
                      }}
                      className="bg-card rounded-xl p-4 border border-border cursor-pointer hover:border-primary transition-colors"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center">
                          <User className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{patient.full_name}</p>
                          <p className="text-sm text-muted-foreground">{patient.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{records.length} records</span>
                        <span className="text-primary flex items-center">
                          View <ChevronRight className="w-4 h-4" />
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {filteredPatients.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No patients found</p>
                </div>
              )}
            </motion.div>
          )}

          {/* Patient Detail View */}
          {viewMode === "patient-detail" && selectedPatient && (
            <motion.div
              key="patient-detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => setViewMode("patients")}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">{selectedPatient.full_name}</h2>
                  <p className="text-muted-foreground">{selectedPatient.phone}</p>
                </div>
              </div>

              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="p-4 border-b border-border">
                  <h3 className="font-semibold text-foreground">Medical History</h3>
                </div>
                <ScrollArea className="h-96">
                  {getPatientRecords(selectedPatient.id).map((record) => (
                    <div key={record.id} className="p-4 border-b border-border last:border-0">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">
                          {new Date(record.created_at).toLocaleDateString()} • Token #{record.tokens?.token_number}
                        </span>
                      </div>
                      {record.diagnosis && (
                        <div className="mb-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase">Diagnosis</p>
                          <p className="text-foreground">{record.diagnosis}</p>
                        </div>
                      )}
                      {record.prescription && (
                        <div className="mb-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase">Prescription</p>
                          <p className="text-foreground whitespace-pre-wrap">{record.prescription}</p>
                        </div>
                      )}
                      {record.notes && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase">Notes</p>
                          <p className="text-foreground">{record.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                  {getPatientRecords(selectedPatient.id).length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                      <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p>No medical records found</p>
                    </div>
                  )}
                </ScrollArea>
              </div>
            </motion.div>
          )}

          {/* Add Record View */}
          {viewMode === "records" && selectedPatient && (
            <motion.div
              key="records"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => setViewMode("tokens")}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Add Patient Record</h2>
                  <p className="text-muted-foreground">For: {selectedPatient.full_name}</p>
                </div>
              </div>

              <div className="bg-card rounded-xl border border-border p-6 space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Diagnosis</label>
                  <Textarea
                    placeholder="Enter diagnosis..."
                    value={recordForm.diagnosis}
                    onChange={(e) => setRecordForm(prev => ({ ...prev, diagnosis: e.target.value }))}
                    rows={3}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Prescription</label>
                  <Textarea
                    placeholder="Enter prescription details..."
                    value={recordForm.prescription}
                    onChange={(e) => setRecordForm(prev => ({ ...prev, prescription: e.target.value }))}
                    rows={4}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Notes</label>
                  <Textarea
                    placeholder="Additional notes..."
                    value={recordForm.notes}
                    onChange={(e) => setRecordForm(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                  />
                </div>
                <div className="flex gap-3">
                  <Button onClick={handleSaveRecord} className="flex-1">
                    <Save className="w-4 h-4 mr-2" /> Save Record & Complete
                  </Button>
                  <Button variant="outline" onClick={() => setViewMode("tokens")}>
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default DoctorDashboard;
