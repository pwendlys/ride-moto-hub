import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DollarSign, Calculator, TrendingUp, Info } from 'lucide-react'
import { useSystemSettings } from '@/hooks/useSystemSettings'

export const PricingInfo = () => {
  const { settings, loading, error } = useSystemSettings()

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Configurações de Preço
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!settings) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Configurações de Preço
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {error || 'Carregando configurações de preço...'}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Configurações de Preço Ativas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pricing Model */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Modelo de Preço:</span>
          <Badge variant={settings.pricing_model === 'per_km' ? 'default' : 'secondary'}>
            {settings.pricing_model === 'per_km' ? 'Por Quilômetro' : 'Preço Fixo'}
          </Badge>
        </div>

        {/* Pricing Details */}
        <div className="space-y-3">
          {settings.pricing_model === 'per_km' ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm">Taxa base:</span>
                <span className="font-semibold">R$ {settings.fixed_rate.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Preço por km:</span>
                <span className="font-semibold">R$ {settings.price_per_km.toFixed(2)}</span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm">Preço fixo:</span>
              <span className="font-semibold">R$ {settings.fixed_rate.toFixed(2)}</span>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <span className="text-sm">Tarifa mínima:</span>
            <span className="font-semibold">R$ {settings.minimum_fare.toFixed(2)}</span>
          </div>
        </div>

        {/* App Fee */}
        <div className="pt-3 border-t">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Taxa Administrativa</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Taxa ({settings.fee_type === 'percentage' ? 'percentual' : 'fixa'}):</span>
            <span className="font-semibold">
              {settings.fee_type === 'percentage' 
                ? `${settings.app_fee_percentage}%` 
                : `R$ ${settings.app_fee_percentage.toFixed(2)}`
              }
            </span>
          </div>
          <div className="bg-primary/10 p-3 rounded-lg mt-2">
            <p className="text-xs text-foreground font-medium mb-1">
              💰 Recebimento de Pagamento
            </p>
            <p className="text-xs text-muted-foreground">
              Você recebe o valor total da corrida diretamente do passageiro. 
              A taxa administrativa deve ser paga posteriormente ao administrador.
            </p>
          </div>
        </div>

        {/* Example Calculation */}
        <div className="pt-3 border-t">
          <div className="flex items-center gap-2 mb-2">
            <Calculator className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Exemplo (5 km)</span>
          </div>
          <div className="space-y-1 text-xs bg-muted/50 p-3 rounded-lg">
            {settings.pricing_model === 'per_km' ? (
              <>
                <div className="flex justify-between">
                  <span>Taxa base:</span>
                  <span>R$ {settings.fixed_rate.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>5 km × R$ {settings.price_per_km.toFixed(2)}:</span>
                  <span>R$ {(5 * settings.price_per_km).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-medium border-t pt-1">
                  <span>Total:</span>
                  <span>R$ {Math.max(settings.fixed_rate + (5 * settings.price_per_km), settings.minimum_fare).toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between font-medium">
                <span>Preço fixo:</span>
                <span>R$ {Math.max(settings.fixed_rate, settings.minimum_fare).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-primary border-t pt-1">
              <span>Valor recebido do passageiro:</span>
              <span>
                R$ {Math.max(
                  settings.pricing_model === 'per_km' 
                    ? settings.fixed_rate + (5 * settings.price_per_km)
                    : settings.fixed_rate, 
                  settings.minimum_fare
                ).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Taxa a pagar ao admin:</span>
              <span>
                R$ {
                  settings.fee_type === 'percentage' 
                    ? (Math.max(
                        settings.pricing_model === 'per_km' 
                          ? settings.fixed_rate + (5 * settings.price_per_km)
                          : settings.fixed_rate, 
                        settings.minimum_fare
                      ) * (settings.app_fee_percentage / 100)).toFixed(2)
                    : settings.app_fee_percentage.toFixed(2)
                }
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-lg">
          <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-xs text-primary">
            Os preços são calculados automaticamente com base nas configurações do administrador.
            {settings.pricing_model === 'per_km' && ' A tarifa mínima é aplicada quando necessário.'}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}