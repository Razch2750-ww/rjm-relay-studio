Buat sebuah aplikasi web/desktop engineering simulator seperti Simurelay, tetapi secara khusus dirancang untuk **perancangan, pengujian, simulasi, dan troubleshooting control panel cold storage**.

Aplikasi bukan sekadar schematic editor. Sistem harus bekerja sebagai **digital twin dari control panel cold storage**, sehingga Wiring Power, Wiring Control, komponen panel, beban, proteksi, tampak depan panel, sensor, dan kondisi fault semuanya saling terhubung dan dapat disimulasikan secara nyata.

# Tujuan Utama

Aplikasi harus memungkinkan pengguna membuat rangkaian control panel cold storage dari nol dengan sistem drag-and-drop, menghubungkan komponen menggunakan kabel, menentukan spesifikasi masing-masing komponen, menentukan besar beban, menjalankan simulasi listrik, melakukan fault injection, dan melihat respons panel seolah-olah panel fisik sedang beroperasi.

Semua bagian aplikasi harus saling sinkron.

Perubahan pada Wiring Control harus memengaruhi Wiring Power.

Perubahan pada Wiring Power harus memengaruhi beban.

Perubahan status beban harus memengaruhi indikator pada Front Panel.

Trip proteksi harus memutus rangkaian sesuai posisi proteksi tersebut.

Selector switch dan tombol pada Front Panel harus benar-benar mengubah rangkaian control.

Jangan membuat komponen atau lampu indikator yang hanya bersifat dekoratif.

# Workspace Utama

Sediakan beberapa workspace yang terhubung dalam satu project:

**Power Wiring**

Digunakan untuk rangkaian tenaga utama seperti incoming supply, MCCB, MCB, contactor, overload, compressor, evaporator, condenser, heater, dan beban lainnya.

**Control Wiring**

Digunakan untuk rangkaian kontrol seperti MCB control, PFR, thermostat/controller, timer, relay, contactor coil, auxiliary contact, overload contact, selector switch, pressure switch, emergency stop, alarm, dan interlock.

**Front Panel**

Menampilkan pintu depan panel secara visual lengkap dengan pilot lamp, selector switch, switch ON/OFF, switch M-O-A, switch 1-0-2, emergency stop, controller Elitech, buzzer, meter, dan perangkat panel lainnya.

**Panel Internal**

Tampilan bagian dalam panel untuk menempatkan MCCB, MCB, contactor, overload, relay, terminal block, controller, DIN rail, wiring duct dan komponen lainnya.

**Simulation**

Workspace khusus untuk menjalankan panel, melihat parameter listrik, status komponen, alarm, fault, serta aliran listrik secara real-time.

Semua workspace menggunakan project dan data rangkaian yang sama.

# Sistem Editor Seperti Simurelay

Gunakan sistem canvas dengan drag-and-drop.

Komponen dapat dipindahkan, diputar 90°, 180°, 270°, di-copy, dihapus, dan diduplikasi.

Saat komponen diputar, simbol, nomor terminal, nama, dan tulisan keterangannya harus ikut menyesuaikan orientasi komponen.

Tulisan tidak boleh bertabrakan dengan kabel.

Sediakan snap-to-grid dan smart alignment.

Kabel harus dapat dibuat secara horizontal dan vertikal dengan routing rapi.

Sediakan automatic wire routing tetapi pengguna tetap dapat mengatur jalur secara manual.

Kabel yang saling menyilang tetapi tidak terkoneksi harus berbeda visual dengan kabel yang memiliki junction.

Setiap terminal harus memiliki ID unik.

Contoh:

KM1-A1
KM1-A2
KM1-13
KM1-14
KM1-21
KM1-22
OL1-95
OL1-96
OL1-97
OL1-98

Gunakan sistem electrical node, bukan hanya garis visual.

Artinya dua kabel dianggap terhubung hanya jika berada pada electrical node yang sama.

# Library Komponen

Library minimal harus memiliki komponen berikut:

Pilot Lamp.

PFR / Phase Failure Relay / Phase Sequence Relay.

Thermal Overload Relay.

MCB 1 Phase.

MCB 3 Phase.

MCCB.

TDR / Time Delay Relay.

Timer Theben.

Contactor.

Auxiliary Contact NO.

Auxiliary Contact NC.

Elitech ETC-974 atau controller cold storage dengan karakteristik serupa.

Switch ON/OFF.

Selector Switch M-O-A / Manual-Off-Auto.

Selector Switch 1-0-2.

KP1 / Pressure Switch.

HP Pressure Switch.

LP Pressure Switch.

Emergency Stop.

Push Button START.

Push Button STOP.

Relay.

Fuse.

Buzzer.

Terminal Block.

Neutral Terminal.

Earth Terminal.

Temperature Probe.

Solenoid Valve.

Voltmeter.

Ampere Meter.

Multifunction Meter.

Semua komponen harus dibuat modular sehingga library dapat ditambahkan kemudian tanpa merombak simulation engine.

# Parameter Komponen

Setiap komponen harus memiliki properties panel.

Contoh pada MCB:

Rated Current.

Jumlah pole.

Trip curve.

Breaking capacity.

Voltage rating.

Status ON/OFF/TRIP.

Contoh MCCB:

Rated current.

Adjustable trip current.

Short circuit protection.

Pole.

Breaking capacity.

Contoh contactor:

Rated operational current.

Coil voltage.

Coil frequency.

Main poles.

Auxiliary NO.

Auxiliary NC.

Status coil.

Status contact.

Contactor harus benar-benar bersifat mekanis secara simulasi.

Jika coil A1-A2 aktif, semua main contact dan auxiliary contact yang terikat pada contactor tersebut harus berubah status.

Jika coil mati, contact kembali ke normal position.

Jika coil rusak, contactor tidak boleh aktif walaupun control circuit memberikan tegangan.

# Thermal Overload

Overload harus memiliki adjustable current.

Contoh:

Range 7–10 A.

Setting 8.5 A.

Simulasi overload jangan hanya menggunakan aturan:

Current > 8.5 A = langsung trip.

Gunakan pendekatan thermal/inverse-time.

Semakin besar arus dibanding setting overload, semakin cepat overload trip.

Contoh kondisi:

105% current → tidak langsung trip.

120% current → membutuhkan waktu.

200% current → trip jauh lebih cepat.

600% current → trip sangat cepat.

Sediakan indikator Thermal Level dari 0–100%.

Thermal overload harus dapat mendingin kembali setelah beban mati.

Sediakan manual reset dan auto reset sebagai pilihan.

Contact 95-96 dan 97-98 harus berubah saat overload trip.

# MCB dan MCCB

MCB dan MCCB harus memiliki model trip thermal dan magnetic.

Simulasikan:

Normal current.

Overload.

Short circuit.

Instantaneous trip.

Sediakan pilihan characteristic curve seperti B, C, dan D jika digunakan.

Status breaker:

ON.

OFF.

TRIPPED.

Breaker yang TRIPPED tidak boleh otomatis berubah menjadi ON sampai di-reset.

# PFR

Phase Failure Relay harus membaca supply L1, L2, dan L3.

Simulasikan:

Phase loss.

Wrong phase sequence.

Phase imbalance.

Under voltage.

Over voltage.

Normal condition.

Pengguna dapat mengatur parameter PFR.

Contoh:

Undervoltage threshold.

Overvoltage threshold.

Phase imbalance percentage.

Delay.

Jika kondisi supply tidak memenuhi requirement PFR, output contact PFR harus berubah.

Akibatnya control circuit yang melewati PFR dapat terputus.

# Supply Listrik

Sediakan berbagai power source.

1 Phase:

L
N
PE

3 Phase:

L1
L2
L3
N
PE

Voltage dapat diubah.

Contoh:

220 V.

230 V.

380 V.

400 V.

415 V.

Frequency:

50 Hz.

60 Hz.

Sediakan opsi simulasi voltage drop dan phase imbalance.

# Load Library

Sediakan objek beban khusus cold storage.

Room Lamp.

Ventilator.

Evaporator Fan.

Condenser Fan.

Compressor.

Defrost Heater.

Drain Heater.

Door Heater.

Crankcase Heater.

Solenoid Valve.

Control Transformer.

General Motor.

General Resistive Load.

Pengguna harus dapat membuat custom load.

# Compressor Simulation

Compressor harus memiliki parameter:

HP / PK.

Rated power.

Rated voltage.

Phase.

Rated current / RLA.

LRA / starting current.

Power factor.

Efficiency.

Starting method.

Running current.

Start duration.

Pengguna dapat memasukkan data secara sederhana hanya berdasarkan HP/PK ataupun menggunakan data nameplate lengkap.

Jika data lengkap tersedia, gunakan data nameplate sebagai prioritas.

Saat compressor pertama start, current tidak langsung sama dengan running current.

Simulasikan starting current / inrush current.

Contoh:

Running 8 A.

Starting 35 A selama beberapa ratus milidetik.

MCB dan overload harus merespons berdasarkan curve masing-masing.

Dengan demikian pengguna dapat mengetahui apabila breaker terlalu kecil sehingga nuisance trip ketika compressor start.

# Evaporator dan Condenser

Evaporator dapat memiliki satu atau beberapa fan.

Setiap fan memiliki:

Rated voltage.

Rated current.

Rated power.

Starting current.

Status RUN / STOP / FAULT.

Condenser memiliki sistem serupa.

Pengguna dapat menentukan jumlah fan dan parameter tiap fan.

# Heater

Heater menggunakan resistive load.

Parameter:

Power kW.

Voltage.

Phase.

Current.

Contoh:

Defrost heater 3 × 1.5 kW.

Sistem harus menghitung total heater load secara otomatis.

# Electrical Calculation Engine

Simulation engine harus menghitung minimal:

Voltage.

Current.

Power.

Apparent power.

Power factor.

Current per phase.

Total panel current.

Current pada setiap branch.

Current pada setiap kabel.

Load percentage.

Breaker utilization.

Contactor utilization.

Overload utilization.

Cable utilization.

Untuk motor 3 phase gunakan pendekatan:

P = √3 × V × I × PF × efficiency.

Untuk single phase:

P = V × I × PF.

Pengguna juga harus dapat memasukkan current langsung dari nameplate sehingga sistem tidak memaksakan perhitungan estimasi.

# Cable Simulation

Setiap wire/cable harus memiliki properties.

Conductor:

Copper.

Aluminium.

Cross section:

0.5 mm²
0.75 mm²
1 mm²
1.5 mm²
2.5 mm²
4 mm²
6 mm²
10 mm²
16 mm²
25 mm²
35 mm²
50 mm²

dan ukuran custom.

Parameter lainnya:

Cable length.

Number of cores.

Insulation type.

Ambient temperature.

Installation method.

Grouping factor.

Pengguna dapat mengaktifkan mode sederhana atau advanced.

Mode sederhana cukup berdasarkan ampacity dasar.

Advanced memperhitungkan correction/derating factors.

Sistem harus menghitung:

Current carrying capacity.

Load percentage.

Voltage drop.

Estimated conductor heating.

Berikan status:

SAFE.

WARNING.

OVERSIZED.

UNDERSIZED.

DANGEROUS.

Jika kabel terlalu kecil, jangan langsung membuat sistem trip karena kabel sendiri bukan protective device.

Simulasikan kenaikan temperatur atau overload kabel.

Breaker atau overload di upstream harus menentukan apakah rangkaian akan trip.

Jika protective device terlalu besar dibanding kemampuan kabel, sistem harus memberi **Critical Protection Coordination Warning**.

# Protection Coordination

Aplikasi harus mengecek hubungan antara:

Cable ampacity.

MCB/MCCB rating.

Overload setting.

Contactor rating.

Load current.

Motor starting current.

Sistem harus bisa mendeteksi kondisi seperti:

MCB terlalu besar terhadap kabel.

MCB terlalu kecil terhadap starting current compressor.

Overload setting terlalu rendah.

Overload terlalu besar sehingga motor kurang terlindungi.

Contactor terlalu kecil dibanding load.

Cable terlalu kecil.

Voltage drop terlalu besar.

Phase load tidak seimbang.

Protection cascading tidak logis.

Tampilkan explanation yang mudah dipahami.

Contoh:

"Compressor normal current = 14.2 A. MCB = 10 A. MCB berpotensi trip saat compressor running."

atau:

"Cable 1.5 mm² membawa 28 A sedangkan kapasitas yang diizinkan pada konfigurasi ini adalah 17 A. Gunakan ukuran cable yang sesuai atau ubah protection rating."

# Control Circuit Engine

Control circuit harus menggunakan electrical logic sebenarnya.

Contoh rangkaian:

L → MCB Control → Emergency Stop NC → PFR → Overload 95-96 → HP → LP → Thermostat → Contactor Coil KM1 → N.

Jika salah satu contact membuka, KM1 harus mati.

Jika KM1 mati:

Compressor mati.

Auxiliary contact KM1 berubah.

Pilot lamp RUN mati.

Pilot lamp STOP dapat menyala apabila rangkaian didesain demikian.

Jangan hardcode perilaku lampu.

Lampu harus mengikuti rangkaian yang dibuat pengguna.

# Front Panel Interactive

Front Panel harus benar-benar interactive.

Pengguna dapat menempatkan:

Main switch.

Elitech.

Pilot lamp.

Selector switch.

Push button.

Emergency stop.

Buzzer.

Voltmeter.

Ampere meter.

Saklar harus dapat diklik saat simulation mode.

Contoh:

Selector COMPRESSOR = MANUAL / OFF / AUTO.

Jika dipindah ke MANUAL, electrical contact yang terkait harus berubah.

Jika OFF, contact berubah ke posisi OFF.

Jika AUTO, contact auto circuit aktif.

Pilot Lamp juga harus membaca node listrik.

Jika lamp menerima tegangan sesuai rating maka lamp ON.

Jika tidak, lamp OFF.

Tidak boleh menggunakan artificial state seperti "lampu hijau = compressor ON" kecuali wiring memang menghubungkannya seperti itu.

# Selector Switch Contact Mapping

Setiap selector switch harus memiliki contact configuration.

Contoh MOA:

MANUAL:
13-14 = closed.
23-24 = open.

OFF:
semua open.

AUTO:
13-14 = open.
23-24 = closed.

Pengguna dapat mengedit contact mapping.

Sediakan switch lain:

ON/OFF.

1-0-2.

HAND-OFF-AUTO.

Forward-Off-Reverse jika nanti diperlukan.

# Elitech ETC-974 Simulation

Controller harus memiliki display digital dan configurable setpoint.

Parameter minimal:

Temperature setpoint.

Differential.

Compressor delay.

High temperature alarm.

Low temperature alarm.

Defrost interval.

Defrost duration.

Fan behavior.

Probe fault.

Sediakan temperature probe virtual.

Temperature dapat diubah secara manual ketika testing.

Contoh:

Room temperature = +8°C.

Setpoint = +2°C.

Differential = 2°C.

Controller meminta compressor bekerja.

Ketika temperature mencapai setpoint, compressor output berhenti sesuai logic setting.

Defrost cycle dapat mengaktifkan heater jika wiring mendukung.

Jangan membuat controller langsung mengaktifkan compressor secara artificial.

Output controller harus berupa electrical contact/output yang harus tetap melewati rangkaian control yang dirancang pengguna.

# Timer Theben

Timer Theben harus memiliki virtual clock.

Pengguna dapat membuat schedule.

Contoh:

ON 08:00.

OFF 17:00.

Weekly schedule.

Manual override.

Output timer berupa contact NO/NC yang dapat digunakan pada rangkaian control.

# TDR

Sediakan tipe:

ON Delay.

OFF Delay.

Interval.

Star delay jika dibutuhkan.

TDR harus memiliki realtime timer indicator.

Contoh:

Delay 5 seconds.

Saat coil mendapat tegangan, countdown berjalan.

Setelah 5 detik contact berubah.

# Pressure Switch KP1 / HP / LP

Pressure switch memiliki parameter:

Cut-in.

Cut-out.

Reset mode.

Normally open/closed contact.

Sediakan virtual suction pressure dan discharge pressure.

Jika pressure melewati batas yang ditentukan, electrical contact berubah.

Contoh LP:

Cut out = 0.5 bar.

Cut in = 1.5 bar.

Jika suction pressure turun di bawah 0.5 bar, contact membuka.

# Simulation Mode

Saat menekan tombol **RUN SIMULATION**, aplikasi masuk ke simulation mode.

Wiring tetap terlihat tetapi tidak dapat diedit kecuali simulation dihentikan.

Gunakan visualisasi aliran listrik.

Line yang energized dapat diberi highlight.

Line de-energized tetap normal.

Jangan menggunakan animasi berlebihan.

Saat simulation berjalan tampilkan realtime:

Supply voltage.

Current L1.

Current L2.

Current L3.

Neutral current.

Total power.

Active compressor.

Active heater.

Active fan.

Active alarm.

Breaker status.

Contactor status.

Overload thermal level.

Cable utilization.

Room temperature.

Suction pressure.

Discharge pressure.

# Fault Injection

Sediakan **Fault Simulator**.

Pengguna dapat mengaktifkan fault tanpa mengubah wiring.

Fault yang minimal harus tersedia:

Phase Failure.

Phase Reversal.

Phase Imbalance.

Under Voltage.

Over Voltage.

PFR Fault.

Compressor Overload.

Compressor Locked Rotor.

Compressor Coil Fault.

Contactor Coil Open.

Contactor Welded Contact.

Overload Trip.

Evaporator Fan Fault.

Condenser Fan Fault.

Heater Overload.

Heater Short Circuit.

HP Fault.

LP Fault.

Temperature Probe Fault.

Elitech Controller Fault.

MCB Trip.

MCCB Trip.

Emergency Stop.

Cable Overload.

Cable High Resistance / Loose Connection.

Open Circuit.

Short Circuit.

Neutral Lost.

Setiap fault harus memengaruhi electrical network secara nyata.

Contoh:

Jika COMP FAULT membuat current compressor naik menjadi 300%, overload akan mulai panas dan kemudian trip berdasarkan thermal model.

Jangan langsung mematikan compressor secara artificial jika rangkaian proteksi seharusnya menentukan respons.

# Fault Scenario Testing

Sediakan scenario test.

Contoh:

Normal operation.

Phase failure.

Compressor overload.

HP trip.

LP trip.

Evaporator failure.

Defrost mode.

Emergency stop.

Power recovery.

Pengguna dapat menjalankan test secara otomatis.

Aplikasi memberikan hasil:

PASS.

WARNING.

FAIL.

Contoh:

HP Fault injected.

HP contact opened.

KM1 coil de-energized.

Compressor stopped.

Alarm lamp ON.

Result: PASS.

Jika compressor masih running setelah HP trip:

Result: FAIL.

Dengan ini aplikasi dapat digunakan untuk memvalidasi interlock rangkaian.

# Cold Storage Process Simulation

Tambahkan simulation sederhana terhadap temperature cold room.

Parameter:

Room dimensions.

Target temperature.

Ambient temperature.

Product load.

Compressor cooling capacity.

Evaporator capacity.

Heat load.

Door opening.

Heater load.

Tidak perlu menjadi software thermodynamic CFD kompleks.

Gunakan simplified thermal model untuk menghubungkan sistem refrigeration dengan control panel.

Ketika compressor dan evaporator aktif:

Room temperature perlahan turun.

Saat compressor OFF:

Room temperature perlahan naik berdasarkan heat load.

Saat defrost heater ON:

Evaporator/room temperature meningkat.

Dengan demikian Elitech dapat bekerja terhadap simulasi temperature yang dinamis.

# Startup Sequence

Sistem harus mampu mensimulasikan urutan startup.

Contoh:

Main MCCB ON.

Control MCB ON.

PFR checks phase.

PFR healthy.

Elitech powered.

Temperature demand detected.

Safety chain checked.

Compressor delay starts.

Contactor coil energized.

Compressor starts.

Starting current appears.

Current stabilizes.

Evaporator starts sesuai logic.

Condenser runs.

RUN indicator turns on.

Semua tahapan harus berasal dari circuit dan component logic.

# Event Log

Sediakan realtime event log.

Contoh:

10:02:11 Main MCCB ON
10:02:12 Control voltage detected
10:02:13 PFR NORMAL
10:02:18 ETC974 cooling request
10:02:18 KM1 energized
10:02:18 Compressor starting current 34.8 A
10:02:20 Compressor current stable 8.4 A
10:12:41 HP switch OPEN
10:12:41 KM1 de-energized
10:12:41 COMPRESSOR STOP
10:12:41 ALARM HP ACTIVE

Event log dapat difilter berdasarkan:

Power.

Control.

Protection.

Fault.

Controller.

User action.

# Electrical Measurement Tools

Sediakan virtual multimeter.

Mode:

AC Voltage.

DC Voltage jika nantinya digunakan.

Current clamp.

Continuity.

Resistance.

Pengguna dapat memilih dua node untuk mengukur voltage.

Contoh:

A1 → N = 220 V.

13 → 14 = 0 V ketika contact closed.

L1 → L2 = 380 V.

Virtual clamp meter dapat ditempatkan pada cable untuk membaca current.

# Wiring Validation

Sediakan tombol:

**CHECK WIRING**

Sebelum simulation dijalankan, aplikasi mengecek:

Floating wire.

Open coil.

Missing neutral.

Short circuit.

L-N short.

L-L short.

Wrong supply.

Wrong coil voltage.

Unused terminals.

Duplicate connection.

Invalid contact association.

Missing protection.

Cable size issue.

Contactor undersized.

Breaker undersized.

Breaker oversized compared with cable.

Overload setting issue.

Phase imbalance.

Logic conflict.

Hasil checker dibagi:

ERROR.

WARNING.

INFO.

Klik error harus membawa pengguna langsung ke lokasi komponen bermasalah.

# Auto Numbering

Sediakan automatic component numbering.

Contoh:

QF1 MCCB.

QF2 MCB Compressor.

QF3 MCB Heater.

KM1 Compressor Contactor.

KM2 Heater Contactor.

OL1 Compressor Overload.

KA1 Control Relay.

KT1 Timer.

HL1 Power Lamp.

HL2 Run Lamp.

HL3 Fault Lamp.

S1 Selector.

S2 Emergency Stop.

TB1 Terminal Block.

Nama dapat diedit manual.

# Wire Numbering

Setiap wire dapat diberikan nomor otomatis.

Contoh:

1.
2.
3.
4.

atau berdasarkan potential:

L1.

L2.

L3.

N.

24V+.

0V.

Sediakan automatic wire label.

Wire label mengikuti posisi dan tidak menabrak line.

# Cross Reference

Jika contactor KM1 mempunyai coil di halaman Control dan main contact di halaman Power, keduanya harus terhubung.

Klik KM1 pada Power dapat menunjukkan:

"Coil located at Control / Sheet 2 / coordinate C4."

Auxiliary contact juga mempunyai cross-reference ke coil.

# Multi Sheet Drawing

Project dapat mempunyai beberapa sheet.

Contoh:

01 – Single Line Diagram.

02 – Power Wiring.

03 – Control Wiring Compressor.

04 – Defrost Control.

05 – Panel Front Layout.

06 – Panel Internal Layout.

07 – Terminal Diagram.

08 – Cable Schedule.

09 – BOM.

Semua tetap satu project.

# Panel Front Designer

Pengguna dapat membuat ukuran panel.

Contoh:

600 × 800 mm.

800 × 1000 mm.

Lalu menempatkan komponen panel berdasarkan ukuran fisik.

Sediakan ruler dan dimension.

Lampu indikator serta selector harus memiliki ukuran visual realistis.

Misalnya:

22 mm pilot lamp.

22 mm selector switch.

Emergency stop 22 mm.

Controller rectangular cutout.

Sediakan automatic alignment.

# Panel Internal Layout

Sediakan DIN rail.

Wiring duct.

Component placement.

Terminal rail.

MCCB mounting.

Contactor + overload assembly.

Sediakan warning jika komponen bertabrakan.

Tambahkan estimasi ruang kosong panel.

# Bill of Material

Buat BOM otomatis dari drawing.

Kolom:

No.

Tag.

Component.

Brand.

Model.

Specification.

Rating.

Quantity.

Description.

Pengguna dapat menentukan preferred brand.

Contoh opsi brand:

Schneider.

CHINT.

Danfoss.

Elitech.

Theben.

dan Custom.

# Cable Schedule

Generate otomatis cable schedule.

Contoh:

From.

To.

Cable size.

Core.

Length.

Load current.

Protection.

Voltage drop.

Status.

# Terminal Schedule

Generate terminal schedule otomatis.

Contoh:

Terminal.

Function.

From.

To.

Voltage.

Wire number.

# Project Data

Project harus menyimpan:

Drawing.

Component placement.

Component parameters.

Cable parameters.

Front panel layout.

Simulation parameters.

Fault scenarios.

Event history.

Room parameters.

BOM.

Cable schedule.

Semua data harus tetap konsisten.

# Save System

Sediakan:

New Project.

Save.

Save As.

Open.

Auto Save.

Undo.

Redo.

Project dapat disimpan lokal dan nantinya dapat disinkronkan ke account/cloud.

Gunakan format project berbasis JSON yang mudah di-versioning.

# Export

Sediakan export:

PDF drawing.

PNG/SVG schematic.

BOM Excel.

Cable Schedule Excel.

Terminal Schedule Excel.

Panel Front Layout PDF.

Panel Internal Layout PDF.

Simulation Report PDF.

Fault Test Report PDF.

Project JSON.

# Simulation Report

Report harus berisi:

Project name.

Supply data.

Load summary.

Protection summary.

Cable summary.

Normal operation test.

Fault test.

Maximum current.

Voltage drop.

Warning.

Error.

Test result.

Timestamp.

# Dashboard Project

Saat membuka project tampilkan ringkasan:

Supply.

Total connected load.

Maximum demand.

Number of circuits.

Breaker count.

Contactor count.

Total compressor load.

Total heater load.

Total fan load.

Cable warnings.

Protection warnings.

Wiring errors.

Last simulation result.

# UI / UX

Gunakan layout engineering software profesional.

Jangan menggunakan desain seperti landing page SaaS.

Canvas harus menjadi fokus terbesar.

Left sidebar:

Component Library.

Center:

Drawing Workspace.

Right sidebar:

Properties.

Bottom drawer:

Simulation / Logs / Errors.

Top toolbar:

Select.

Wire.

Delete.

Rotate.

Undo.

Redo.

Zoom.

Run.

Stop.

Check Wiring.

Fault Simulator.

Panel kiri, kanan, atas, dan bawah harus dapat di-collapse/minimize sehingga canvas dapat menggunakan hampir seluruh layar.

Sediakan zoom menggunakan mouse wheel.

Pan menggunakan middle mouse atau Space + Drag.

Sediakan fit drawing.

Sediakan minimap untuk project besar.

# Visual Style

Gunakan style technical CAD/electrical software.

Background canvas putih atau abu muda.

Grid tipis.

Wire hitam dalam editing mode.

Gunakan warna hanya untuk status.

Contoh:

Green = energized / healthy.

Red = fault / trip.

Orange = warning.

Gray = inactive.

Tetap prioritaskan keterbacaan diagram.

Hindari gradient, glassmorphism, neon, card berlebihan, dan desain generik AI dashboard.

# Architecture Requirement

Pisahkan aplikasi menjadi beberapa engine:

Electrical Network Engine.

Control Logic Engine.

Protection Engine.

Motor/Load Engine.

Cable Thermal Engine.

Cold Room Thermal Engine.

Fault Engine.

Schematic Renderer.

Panel Front Renderer.

Project Data Engine.

Report Engine.

Jangan mencampurkan perhitungan simulation langsung di UI component.

UI hanya menjadi renderer dan interface terhadap simulation engine.

Gunakan graph/node model untuk electrical circuit.

Setiap terminal adalah node/connection point.

Setiap component memiliki state machine sendiri.

# Realtime Simulation Tick

Gunakan simulation engine berbasis timestep.

Contoh:

10 ms–100 ms simulation tick untuk electrical/control state.

Thermal system dapat menggunakan timestep lebih lambat.

Event seperti short circuit, magnetic trip, dan contactor switching membutuhkan fast event evaluation.

Temperature simulation dapat berjalan dengan accelerated time.

Contoh:

1 real second = 1 simulated minute.

Pengguna dapat memilih:

1×.

5×.

10×.

60×.

# Debug Mode

Sediakan Engineering Debug Mode.

Saat hover pada kabel tampilkan:

Voltage.

Current.

Node ID.

Wire number.

Cable size.

Temperature.

Saat hover contactor tampilkan:

Coil voltage.

Coil state.

Main contact state.

Auxiliary contact state.

Load current.

Saat hover breaker tampilkan:

Rated current.

Actual current.

Load percentage.

Thermal state.

Trip state.

# Example Default Project

Sertakan satu sample project cold storage.

Contoh:

Supply 3 Phase 380 V.

Main MCCB.

PFR.

Control MCB.

Elitech ETC-974.

Compressor Contactor.

Compressor Overload.

HP/LP safety.

Evaporator Contactor.

Heater Contactor.

Defrost Timer.

Room Lamp.

Ventilator.

Pilot Lamp:

POWER.

RUN.

DEFROST.

FAULT.

Selector:

COMPRESSOR M-O-A.

EVAP M-O-A.

HEATER M-O-A.

Emergency Stop.

Sample harus dapat langsung dijalankan agar pengguna dapat memahami cara kerja aplikasi.

# Accuracy Philosophy

Aplikasi harus memprioritaskan engineering logic daripada animasi.

Jangan fake simulation.

Jangan membuat status berdasarkan script UI sederhana seperti:

"Jika tombol Start ditekan maka compressor = ON."

Yang benar adalah:

Tombol Start mengubah electrical contact.

Electrical network dihitung ulang.

Coil contactor menerima atau tidak menerima voltage.

State contactor berubah.

Main contact berubah.

Power circuit berubah.

Motor mendapatkan supply.

Motor menghasilkan current.

Protection membaca current.

Pilot lamp membaca tegangan dari rangkaiannya.

Semua hasil merupakan konsekuensi dari electrical circuit.

# Validation

Buat automated test terhadap simulation engine.

Minimal uji:

Normal compressor startup.

Wrong phase sequence.

Phase loss.

HP trip.

LP trip.

Motor overload.

MCB overload.

Short circuit.

Cable undersized.

Overload reset.

Emergency stop.

Manual mode.

Auto mode.

Defrost mode.

Elitech temperature demand.

Timer operation.

Contactor auxiliary interlock.

Controller probe fault.

Setiap test harus memiliki expected result.

# Scalability

Struktur software harus memungkinkan komponen baru ditambahkan nanti seperti:

VFD.

Soft starter.

PLC.

Digital thermostat lain.

Electronic expansion valve.

Oil pressure safety.

Current relay.

Flow switch.

Door switch.

Humidity controller.

Modbus device.

Remote monitoring.

IoT sensor.

HMI.

Tanpa melakukan rewrite besar terhadap electrical simulation engine.

# Fokus Utama Produk

Aplikasi ini harus terasa seperti gabungan:

Electrical CAD.

Relay Simulator.

Control Panel Designer.

Cold Storage Simulator.

Protection Calculator.

Panel Testing Simulator.

Troubleshooting Tool.

Tujuan akhirnya adalah pengguna dapat menggambar rangkaian yang benar-benar biasa digunakan di panel cold storage, menjalankannya secara virtual, menekan selector dan emergency stop dari tampak depan panel, melihat contactor bekerja, melihat compressor/fan/heater mendapatkan supply, melihat besar current sebenarnya, kemudian memasukkan berbagai fault untuk memastikan seluruh protection dan interlock bekerja sesuai desain.

Hasil akhir tidak boleh sekadar prototype visual.

Prioritaskan terlebih dahulu simulation engine, electrical connectivity, component logic, protection logic, dan hubungan Power-Control-Front Panel sebelum menambahkan fitur kosmetik lainnya.