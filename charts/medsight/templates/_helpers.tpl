{{- define "medsight.labels" -}}
app.kubernetes.io/name: medsight
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Values.image.tag | trunc 63 | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "medsight.selectorLabels" -}}
app.kubernetes.io/name: medsight
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
