import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, MapPin, Stethoscope, Clock, CreditCard, CheckCircle } from "lucide-react";
import Navbar from "@/components/Navbar";

type Clinic = {
  id: string;
  clinic_name: string;
  address: string;
  city: string;
  doctor_id: string;
};

type Doctor = {
  id: string;
  user_id: string;
  specialization: string;
  consultation_fee: number;
  experience_years: number;
  timings: any;
  profiles: { full_name: string };
};

type TimeSlot = {
  time: string;
  available: boolean;
};

const BookAppointment = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [symptoms, setSymptoms] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [tokenNumber, setTokenNumber] = useState<number | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (step === 1) {
      fetchClinics();
    }
  }, [step]);

  useEffect(() => {
    if (selectedClinic) {
      fetchDoctors(selectedClinic.doctor_id);
    }
  }, [selectedClinic]);

  useEffect(() => {
    if (selectedDoctor && selectedDate) {
      generateTimeSlots();
    }
  }, [selectedDoctor, selectedDate]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setUser(user);
  };

  const fetchClinics = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("clinics")
      .select("*")
      .eq("city", "Vizag");
    
    if (error) {
      toast({ title: "Error loading clinics", variant: "destructive" });
      console.error(error);
    } else {
      setClinics(data || []);
    }
    setLoading(false);
  };

  const fetchDoctors = async (doctorId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("doctors")
      .select("*, profiles!doctors_user_id_fkey(full_name)")
      .eq("id", doctorId)
      .eq("is_active", true);
    
    if (error) {
      toast({ title: "Error loading doctors", variant: "destructive" });
      console.error(error);
    } else {
      // Transform the data to handle profiles array from Supabase join
      const transformedData = (data || []).map(doc => ({
        ...doc,
        profiles: Array.isArray(doc.profiles) ? doc.profiles[0] : doc.profiles || { full_name: 'Unknown Doctor' }
      })) as Doctor[];
      setDoctors(transformedData);
    }
    setLoading(false);
  };

  const generateTimeSlots = () => {
    const slots: TimeSlot[] = [];
    const startHour = 9;
    const endHour = 18;
    
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute of [0, 30]) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push({ time, available: true });
      }
    }
    setTimeSlots(slots);
  };

  const handleClinicSelect = (clinic: Clinic) => {
    setSelectedClinic(clinic);
    setStep(2);
  };

  const handleDoctorSelect = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setStep(3);
  };

  const handleTimeSelect = () => {
    if (!selectedDate || !selectedTime) {
      toast({ title: "Please select date and time", variant: "destructive" });
      return;
    }
    setStep(4);
  };

  const handlePayment = async () => {
    if (!user || !selectedDoctor || !selectedClinic) return;

    setLoading(true);
    try {
      // Create appointment
      const { data: appointment, error: apptError } = await supabase
        .from("appointments")
        .insert({
          patient_id: user.id,
          doctor_id: selectedDoctor.id,
          appointment_date: selectedDate,
          appointment_time: selectedTime,
          symptoms: symptoms,
          payment_status: "completed",
          payment_method: paymentMethod,
          status: "confirmed"
        })
        .select()
        .single();

      if (apptError) throw apptError;

      // Get next token number for the day
      const { data: existingTokens } = await supabase
        .from("tokens")
        .select("token_number")
        .eq("doctor_id", selectedDoctor.id)
        .eq("token_date", selectedDate)
        .order("token_number", { ascending: false })
        .limit(1);

      const nextTokenNumber = existingTokens && existingTokens.length > 0 
        ? existingTokens[0].token_number + 1 
        : 1;

      // Create token
      const { data: token, error: tokenError } = await supabase
        .from("tokens")
        .insert({
          doctor_id: selectedDoctor.id,
          patient_id: user.id,
          appointment_id: appointment.id,
          token_number: nextTokenNumber,
          token_date: selectedDate,
          token_type: "appointment",
          status: "waiting",
          estimated_time: `${selectedDate}T${selectedTime}`
        })
        .select()
        .single();

      if (tokenError) throw tokenError;

      setTokenNumber(nextTokenNumber);
      setStep(5);
      toast({ title: "Appointment booked successfully!" });
    } catch (error: any) {
      toast({ title: "Error booking appointment", description: error.message, variant: "destructive" });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          {step < 5 && (
            <Button
              variant="ghost"
              onClick={() => step === 1 ? navigate("/") : setStep(step - 1)}
              className="mb-6"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          )}

          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              {[1, 2, 3, 4, 5].map((s) => (
                <div key={s} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {s}
                  </div>
                  {s < 5 && <div className={`h-1 w-12 mx-2 ${step > s ? "bg-primary" : "bg-muted"}`} />}
                </div>
              ))}
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold">
                {step === 1 && "Select Clinic"}
                {step === 2 && "Select Doctor"}
                {step === 3 && "Choose Time Slot"}
                {step === 4 && "Payment"}
                {step === 5 && "Booking Confirmed"}
              </h2>
            </div>
          </div>

          {/* Step 1: Select Clinic */}
          {step === 1 && (
            <div className="grid md:grid-cols-2 gap-4">
              {loading ? (
                <p>Loading clinics...</p>
              ) : clinics.length === 0 ? (
                <p>No clinics available in Vizag</p>
              ) : (
                clinics.map((clinic) => (
                  <Card
                    key={clinic.id}
                    className="p-6 cursor-pointer hover:border-primary transition-smooth"
                    onClick={() => handleClinicSelect(clinic)}
                  >
                    <div className="flex items-start gap-4">
                      <MapPin className="h-6 w-6 text-primary" />
                      <div>
                        <h3 className="font-semibold text-lg">{clinic.clinic_name}</h3>
                        <p className="text-muted-foreground text-sm">{clinic.address}</p>
                        <p className="text-muted-foreground text-sm">{clinic.city}</p>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Step 2: Select Doctor */}
          {step === 2 && selectedClinic && (
            <div className="space-y-4">
              <Card className="p-4 bg-muted">
                <p className="text-sm"><strong>Selected Clinic:</strong> {selectedClinic.clinic_name}</p>
              </Card>
              <div className="grid md:grid-cols-2 gap-4">
                {loading ? (
                  <p>Loading doctors...</p>
                ) : doctors.length === 0 ? (
                  <p>No doctors available</p>
                ) : (
                  doctors.map((doctor) => (
                    <Card
                      key={doctor.id}
                      className="p-6 cursor-pointer hover:border-primary transition-smooth"
                      onClick={() => handleDoctorSelect(doctor)}
                    >
                      <div className="flex items-start gap-4">
                        <Stethoscope className="h-6 w-6 text-primary" />
                        <div>
                          <h3 className="font-semibold text-lg">{doctor.profiles.full_name}</h3>
                          <p className="text-muted-foreground text-sm">{doctor.specialization}</p>
                          <p className="text-sm">{doctor.experience_years} years experience</p>
                          <p className="text-primary font-semibold mt-2">₹{doctor.consultation_fee}</p>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Step 3: Select Time */}
          {step === 3 && selectedDoctor && (
            <div className="space-y-6">
              <Card className="p-4 bg-muted">
                <p className="text-sm"><strong>Doctor:</strong> {selectedDoctor.profiles.full_name} - {selectedDoctor.specialization}</p>
              </Card>
              
              <div>
                <Label htmlFor="date">Select Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="mt-2"
                />
              </div>

              {selectedDate && (
                <div>
                  <Label>Select Time Slot</Label>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {timeSlots.map((slot) => (
                      <Button
                        key={slot.time}
                        variant={selectedTime === slot.time ? "default" : "outline"}
                        onClick={() => setSelectedTime(slot.time)}
                        disabled={!slot.available}
                      >
                        {slot.time}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="symptoms">Symptoms (Optional)</Label>
                <Textarea
                  id="symptoms"
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  placeholder="Describe your symptoms..."
                  className="mt-2"
                />
              </div>

              <Button onClick={handleTimeSelect} className="w-full">
                Continue to Payment
              </Button>
            </div>
          )}

          {/* Step 4: Payment */}
          {step === 4 && selectedDoctor && (
            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="font-semibold mb-4">Booking Summary</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>Clinic:</strong> {selectedClinic?.clinic_name}</p>
                  <p><strong>Doctor:</strong> {selectedDoctor.profiles.full_name}</p>
                  <p><strong>Specialization:</strong> {selectedDoctor.specialization}</p>
                  <p><strong>Date:</strong> {selectedDate}</p>
                  <p><strong>Time:</strong> {selectedTime}</p>
                  <p className="text-lg font-bold text-primary pt-2">
                    Total: ₹{selectedDoctor.consultation_fee}
                  </p>
                </div>
              </Card>

              <div>
                <Label>Payment Method</Label>
                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="mt-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="card" id="card" />
                    <Label htmlFor="card">Credit/Debit Card</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="upi" id="upi" />
                    <Label htmlFor="upi">UPI</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cash" id="cash" />
                    <Label htmlFor="cash">Cash at Clinic</Label>
                  </div>
                </RadioGroup>
              </div>

              <Button onClick={handlePayment} disabled={loading} className="w-full">
                <CreditCard className="mr-2 h-4 w-4" />
                {loading ? "Processing..." : "Confirm & Pay"}
              </Button>
            </div>
          )}

          {/* Step 5: Confirmation */}
          {step === 5 && (
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <CheckCircle className="h-24 w-24 text-primary" />
              </div>
              <h2 className="text-3xl font-bold">Booking Confirmed!</h2>
              <Card className="p-6 max-w-md mx-auto">
                <p className="text-5xl font-bold text-primary mb-4">Token #{tokenNumber}</p>
                <div className="space-y-2 text-left">
                  <p><strong>Clinic:</strong> {selectedClinic?.clinic_name}</p>
                  <p><strong>Doctor:</strong> {selectedDoctor?.profiles.full_name}</p>
                  <p><strong>Date:</strong> {selectedDate}</p>
                  <p><strong>Time:</strong> {selectedTime}</p>
                </div>
              </Card>
              <p className="text-muted-foreground">
                Please arrive 10 minutes before your appointment time.
              </p>
              <div className="flex gap-4 justify-center">
                <Button onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
                <Button variant="outline" onClick={() => navigate("/")}>Back to Home</Button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default BookAppointment;
