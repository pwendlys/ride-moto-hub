import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { signInSchema, signUpSchema, validateData, sanitizeString } from "@/lib/validations";
import { Bike, User, Mail, Phone, Lock, FileText, Car, Eye, EyeOff, AlertTriangle, Shield } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [userType, setUserType] = useState<"passenger" | "driver">("passenger");
  const [showPassword, setShowPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const { signIn, signUp, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  
  // Driver specific fields
  const [cnh, setCnh] = useState("");
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [vehicleType, setVehicleType] = useState<"motorcycle" | "car">("motorcycle");

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }

    // Detectar parâmetros da URL para pré-selecionar tipo de usuário e modo
    const typeParam = searchParams.get('type');
    const modeParam = searchParams.get('mode');
    
    if (typeParam && ['passenger', 'driver'].includes(typeParam)) {
      setUserType(typeParam as "passenger" | "driver");
    }
    
    if (modeParam === 'signup') {
      setIsSignUp(true);
    }
  }, [user, navigate, searchParams]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setValidationErrors([]);

    try {
      if (isSignUp) {
        // Sanitize inputs
        const sanitizedData = {
          email: sanitizeString(email),
          password,
          full_name: sanitizeString(fullName),
          phone: sanitizeString(phone),
          user_type: userType,
        };

        // Validate sign up data
        const validation = validateData(signUpSchema, sanitizedData);
        if (!validation.success) {
          setValidationErrors([validation.error || "Dados inválidos"]);
          toast({
            title: "Dados Inválidos",
            description: validation.error,
            variant: "destructive",
          });
          return;
        }

        // Driver specific validation
        if (userType === "driver") {
          const driverData = {
            cnh: sanitizeString(cnh),
            vehicle_brand: sanitizeString(vehicleBrand),
            vehicle_model: sanitizeString(vehicleModel),
            vehicle_plate: sanitizeString(vehiclePlate).toUpperCase(),
            vehicle_color: sanitizeString(vehicleColor),
            vehicle_type: vehicleType,
          };

          // Additional driver validation
          if (!driverData.cnh || driverData.cnh.length < 5) {
            throw new Error("CNH deve ter pelo menos 5 caracteres");
          }
          if (!driverData.vehicle_plate.match(/^[A-Z]{3}-?\d{4}$/)) {
            throw new Error("Formato de placa inválido (ex: ABC-1234)");
          }

          Object.assign(sanitizedData, driverData);
        }

        const { error } = await signUp(sanitizedData.email, sanitizedData.password, sanitizedData);
        
        if (error) {
          // Handle specific auth errors
          if (error.message?.includes("already registered")) {
            throw new Error("Este email já está cadastrado");
          }
          if (error.message?.includes("password")) {
            throw new Error("Senha deve ter pelo menos 8 caracteres com maiúscula, minúscula e número");
          }
          throw error;
        }
        
        toast({
          title: "Conta criada com sucesso!",
          description: userType === "driver" 
            ? "Seu cadastro será analisado em até 24 horas." 
            : "Bem-vindo ao MotoHub!",
        });
        
        navigate("/dashboard");
      } else {
        // Validate sign in data
        const loginData = { email: sanitizeString(email), password };
        const validation = validateData(signInSchema, loginData);
        
        if (!validation.success) {
          toast({
            title: "Dados Inválidos",
            description: validation.error,
            variant: "destructive",
          });
          return;
        }

        const { error } = await signIn(loginData.email, loginData.password);
        
        if (error) {
          // Handle specific auth errors
          if (error.message?.includes("Invalid login credentials")) {
            throw new Error("Email ou senha incorretos");
          }
          if (error.message?.includes("too many requests")) {
            throw new Error("Muitas tentativas de login. Tente novamente em alguns minutos.");
          }
          throw error;
        }
        
        toast({
          title: "Login realizado com sucesso!",
          description: "Bem-vindo de volta!",
        });
        
        navigate("/dashboard");
      }
    } catch (error: any) {
      const errorMessage = error.message || "Ocorreu um erro inesperado";
      setValidationErrors([errorMessage]);
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      {/* Header */}
      <div className="fixed top-0 right-0 z-50 p-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Bike className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold">MotoHub</span>
          </div>
          <CardTitle className="text-2xl">
            {isSignUp ? "Criar Conta" : "Entrar"}
          </CardTitle>
          <CardDescription>
            {isSignUp 
              ? "Cadastre-se para começar a usar o MotoHub" 
              : "Entre na sua conta do MotoHub"
            }
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs value={isSignUp ? "signup" : "signin"} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger 
                value="signin" 
                onClick={() => setIsSignUp(false)}
              >
                Entrar
              </TabsTrigger>
              <TabsTrigger 
                value="signup" 
                onClick={() => setIsSignUp(true)}
              >
                Cadastrar
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              {validationErrors.length > 0 && (
                <Alert className="mb-4 border-destructive/50 text-destructive dark:border-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {validationErrors.map((error, index) => (
                      <div key={index}>{error}</div>
                    ))}
                  </AlertDescription>
                </Alert>
              )}
              
              <form onSubmit={handleAuth} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Digite sua senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading}
                  variant="hero"
                >
                  {isLoading ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleAuth} className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo de Usuário</Label>
                  <Select value={userType} onValueChange={(value: "passenger" | "driver") => setUserType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="passenger">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          Passageiro
                        </div>
                      </SelectItem>
                      <SelectItem value="driver">
                        <div className="flex items-center gap-2">
                          <Bike className="w-4 h-4" />
                          Mototaxista
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nome Completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="fullName"
                        placeholder="Seu nome completo"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        placeholder="(11) 99999-9999"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="8+ caracteres, maiúscula, minúscula e número"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Senha deve conter: maiúscula, minúscula, número e mínimo 8 caracteres
                    </p>
                  </div>
                </div>

                {userType === "driver" && (
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Car className="w-5 h-5" />
                      Dados do Veículo
                    </h3>

                    <div className="space-y-2">
                      <Label htmlFor="cnh">CNH</Label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="cnh"
                          placeholder="Número da CNH"
                          value={cnh}
                          onChange={(e) => setCnh(e.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="vehicleBrand">Marca</Label>
                        <Input
                          id="vehicleBrand"
                          placeholder="Honda, Yamaha, etc."
                          value={vehicleBrand}
                          onChange={(e) => setVehicleBrand(e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="vehicleModel">Modelo</Label>
                        <Input
                          id="vehicleModel"
                          placeholder="CG 160, Factor, etc."
                          value={vehicleModel}
                          onChange={(e) => setVehicleModel(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="vehiclePlate">Placa</Label>
                        <Input
                          id="vehiclePlate"
                          placeholder="ABC-1234"
                          value={vehiclePlate}
                          onChange={(e) => setVehiclePlate(e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="vehicleColor">Cor</Label>
                        <Input
                          id="vehicleColor"
                          placeholder="Preto, Branco, etc."
                          value={vehicleColor}
                          onChange={(e) => setVehicleColor(e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Tipo</Label>
                        <Select value={vehicleType} onValueChange={(value: "motorcycle" | "car") => setVehicleType(value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="motorcycle">Moto</SelectItem>
                            <SelectItem value="car">Carro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading}
                  variant="hero"
                >
                  {isLoading ? "Criando conta..." : "Criar Conta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center">
            <Button 
              variant="link" 
              onClick={() => navigate("/")}
              className="text-sm"
            >
              Voltar para página inicial
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;