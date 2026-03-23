#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================


user_problem_statement: |
  CRM Multi-tenant para Agencias de Seguros - Módulo 04: Reportes y Analytics
  El usuario requiere implementar un módulo completo de reportes con:
  - Dashboard ejecutivo con KPIs
  - Rendimiento de agentes
  - Análisis de cartera (gráficos)
  - Análisis de siniestros
  - Reporte de renovaciones
  - Reporte de comisiones
  - Exportación a Excel
  - Filtros por fecha, agente, ramo

frontend:
  - task: "Página de Reportes con Tabs"
    implemented: true
    working: "NA"
    file: "src/app/(tenant)/reports/page.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Implementada página de reportes con 6 tabs: Dashboard, Agentes, Cartera, Siniestros, Renovaciones, Comisiones. Incluye filtros de fecha, agente, ramo y exportación XLSX."

  - task: "Componente ExecutiveDashboard"
    implemented: true
    working: "NA"
    file: "src/components/modules/reports/ExecutiveDashboard.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Implementados 5 KPIs: Pólizas Activas, Prima del Mes, Siniestros Abiertos, Renovaciones (30 días), Comisiones Pendientes con comparativa vs mes anterior."

  - task: "Componente AgentPerformanceTable"
    implemented: true
    working: "NA"
    file: "src/components/modules/reports/AgentPerformanceTable.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Tabla de rendimiento de agentes con sorting. RadarChart para comparar hasta 3 agentes seleccionados."

  - task: "Componente PortfolioCharts"
    implemented: true
    working: "NA"
    file: "src/components/modules/reports/PortfolioCharts.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "PieChart distribución por ramo, BarChart por aseguradora, LineChart tendencia 12 meses con Recharts."

  - task: "Componente ClaimsAnalytics"
    implemented: true
    working: "NA"
    file: "src/components/modules/reports/ClaimsAnalytics.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "KPIs de siniestros, gráficos por estado y por ramo. Resumen financiero con total reclamado/aprobado."

  - task: "Componente RenewalReport"
    implemented: true
    working: "NA"
    file: "src/components/modules/reports/RenewalReport.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Tabla de pólizas por vencer con estado de gestión (sin_gestion/en_contacto/renovado). Acción rápida para crear oportunidad en Pipeline."

  - task: "Componente CommissionsReport"
    implemented: true
    working: "NA"
    file: "src/components/modules/reports/CommissionsReport.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Reporte detallado de comisiones por póliza. Agrupación por agente. Totales y promedios."

  - task: "Navegación a Reportes en Sidebar"
    implemented: true
    working: "NA"
    file: "src/app/(tenant)/layout.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Agregado enlace 'Reportes' en sidebar con icono BarChart3."

  - task: "Exportación Excel (XLSX)"
    implemented: true
    working: "NA"
    file: "src/app/(tenant)/reports/page.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Función handleExportExcel genera XLSX con sheets: Dashboard, Agentes, Renovaciones, Comisiones usando librería xlsx/sheetjs."

backend:
  - task: "Funciones SQL para Reportes"
    implemented: true
    working: "NA"
    file: "supabase/migrations/00004_reports.sql"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          Migración SQL creada con funciones:
          - get_executive_dashboard: KPIs ejecutivos
          - get_agent_performance: Rendimiento por agente
          - get_portfolio_by_line: Distribución por ramo
          - get_portfolio_by_insurer: Distribución por aseguradora
          - get_premium_trend: Tendencia 12 meses
          - get_claims_analytics: Métricas de siniestros
          - get_renewal_report: Pólizas por vencer
          - get_commissions_report: Comisiones detalladas
          NOTA: Las funciones deben ejecutarse en Supabase SQL Editor. El frontend tiene fallbacks que funcionan sin las funciones RPC.

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 1
  run_ui: true

test_plan:
  current_focus:
    - "Página de Reportes con Tabs"
    - "Navegación a Reportes en Sidebar"
    - "ExecutiveDashboard KPIs"
    - "Exportación Excel"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Implementación completa del Módulo 04 - Reportes y Analytics:
      
      ARCHIVOS CREADOS:
      1. supabase/migrations/00004_reports.sql - Funciones SQL
      2. src/lib/validations/reports.ts - Tipos y schemas Zod
      3. src/components/modules/reports/KPICard.tsx
      4. src/components/modules/reports/ExecutiveDashboard.tsx
      5. src/components/modules/reports/AgentPerformanceTable.tsx
      6. src/components/modules/reports/PortfolioCharts.tsx
      7. src/components/modules/reports/ClaimsAnalytics.tsx
      8. src/components/modules/reports/RenewalReport.tsx
      9. src/components/modules/reports/CommissionsReport.tsx
      10. src/components/modules/reports/index.ts
      11. src/app/(tenant)/reports/page.tsx
      
      ARCHIVOS MODIFICADOS:
      - src/app/(tenant)/layout.tsx - Agregado enlace Reportes en sidebar
      - src/lib/supabase/database-types.ts - Agregados tipos para funciones RPC
      
      DEPENDENCIAS INSTALADAS:
      - recharts (gráficos)
      - xlsx (exportación Excel)
      - date-fns (manejo de fechas)
      
      NOTAS IMPORTANTES:
      - El frontend usa fallbacks directos a las tablas cuando las funciones RPC no existen
      - Las funciones SQL deben ejecutarse manualmente en Supabase SQL Editor
      - Build de Next.js exitoso
      - La página de reportes está en /reports
