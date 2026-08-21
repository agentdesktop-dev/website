{{- define "agentdesktop-postgresql.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "agentdesktop-postgresql.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "agentdesktop-postgresql.labels" -}}
app.kubernetes.io/name: {{ include "agentdesktop-postgresql.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: agentdesktop
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
{{- end -}}

{{- define "agentdesktop-postgresql.selectorLabels" -}}
app.kubernetes.io/name: {{ include "agentdesktop-postgresql.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: database
{{- end -}}

{{- define "agentdesktop-postgresql.serviceHost" -}}
{{- printf "%s.%s.svc.cluster.local" (include "agentdesktop-postgresql.fullname" .) .Release.Namespace -}}
{{- end -}}