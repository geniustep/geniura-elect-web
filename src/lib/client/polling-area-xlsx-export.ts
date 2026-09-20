"use client";

import ExcelJS from "@andreeewill/exceljs/dist/exceljs.min.js";
import JSZip from "jszip";

export type PollingAreaExportRow = {
  compensation?: number | null;
  phone?: string | null;
  voterNumber?: string | null;
  rbo?: string | null;
  observerName?: string | null;
  registeredVoters?: number | null;
  officeNumber: number;
  pollingCenterName: string;
  centralOfficeName?: string | null;
  centralOfficeNumber?: number | null;
  hasRepresentative: boolean;
};

const exactHeaders = [
  "التعويض",
  "رقم الهاتف",
  "رقم الناخب",
  "ر ب و",
  "إسم المراقب",
  "عدد المسجَّلين",
  "رقم مكتب \nالتصويت",
  "عنوان مكتب التصويت",
  "عنوان المكتب المركزي",
  "رقم المكتب \nالمركزي",
];

const BLACK = "FF000000";
const HEADER_BLUE = "FF95B3D7";
const EMPTY_OBSERVER_GRAY = "FFD9D9D9";
const thinBlack = {
  top: { style: "thin" as const, color: { argb: BLACK } },
  bottom: { style: "thin" as const, color: { argb: BLACK } },
  left: { style: "thin" as const, color: { argb: BLACK } },
  right: { style: "thin" as const, color: { argb: BLACK } },
};

function electionDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  const months = [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "ماي",
    "يونيو",
    "يوليوز",
    "غشت",
    "شتنبر",
    "أكتوبر",
    "نونبر",
    "دجنبر",
  ];

  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function applyCellBase(cell: ExcelJS.Cell) {
  cell.font = {
    name: "Arial",
    size: 12,
    bold: true,
    color: { argb: BLACK },
  };
  cell.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };
  cell.border = thinBlack;
}

function buildAreaSheet(
  workbook: ExcelJS.Workbook,
  electionDate: string,
  rows: PollingAreaExportRow[],
) {
  const worksheet = workbook.addWorksheet("معطيات المراقبين");

  worksheet.properties.defaultRowHeight = 33.95;
  worksheet.columns = [
    { width: 12.5, hidden: true },
    { width: 13.625 },
    { width: 11.5 },
    { width: 12.375 },
    { width: 17.5 },
    { width: 11.5 },
    { width: 9.625 },
    { width: 21.625 },
    { width: 20.5 },
    { width: 11.125 },
  ];

  worksheet.getRow(1).height = 24;
  worksheet.getRow(2).height = 18;
  worksheet.getRow(3).height = 13.5;
  worksheet.getRow(4).height = 33.95;

  worksheet.getRow(1).height = 33.95;

  const header = worksheet.getRow(4);
  exactHeaders.forEach((value, index) => {
    const cell = header.getCell(index + 1);
    cell.value = value;
    applyCellBase(cell);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEADER_BLUE },
    };
  });

  const sortedRows = [...rows].sort(
    (left, right) => left.officeNumber - right.officeNumber,
  );

  sortedRows.forEach((item, index) => {
    const rowNumber = index + 5;
    const row = worksheet.getRow(rowNumber);
    row.height = 33.95;

    row.values = [
      item.compensation ?? "",
      item.phone ?? "",
      item.voterNumber ?? "",
      item.rbo ?? "",
      item.observerName ?? "",
      item.registeredVoters ?? "",
      item.officeNumber,
      item.pollingCenterName,
      item.centralOfficeName ?? "",
      item.centralOfficeNumber ?? "",
    ];

    for (let col = 1; col <= 10; col += 1) {
      applyCellBase(row.getCell(col));
    }

    if (!item.hasRepresentative) {
      for (let col = 2; col <= 5; col += 1) {
        row.getCell(col).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: EMPTY_OBSERVER_GRAY },
        };
      }
    }
  });

  let groupStart = 5;
  let currentKey = sortedRows[0]?.centralOfficeNumber
    ? `${sortedRows[0].centralOfficeNumber}|${sortedRows[0].centralOfficeName ?? ""}`
    : "";

  for (let index = 1; index <= sortedRows.length; index += 1) {
    const item = sortedRows[index];
    const nextKey = item?.centralOfficeNumber
      ? `${item.centralOfficeNumber}|${item.centralOfficeName ?? ""}`
      : "";

    if (currentKey && nextKey === currentKey) continue;

    const endRow = index + 4;
    if (currentKey && endRow > groupStart) {
      worksheet.mergeCells(`I${groupStart}:I${endRow}`);
      worksheet.mergeCells(`J${groupStart}:J${endRow}`);
      worksheet.getCell(`I${groupStart}`).alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      worksheet.getCell(`J${groupStart}`).alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
    }

    groupStart = index + 5;
    currentKey = nextKey;
  }

  const lastRow = Math.max(5, sortedRows.length + 4);
  worksheet.pageSetup = {
    paperSize: 9,
    orientation: "portrait",
    scale: 81,
    horizontalCentered: true,
    verticalCentered: true,
    printArea: `B1:J${lastRow}`,
    printTitlesRow: "1:4",
    margins: {
      left: 0.11811023622047245,
      right: 0.31496062992125984,
      top: 0.15748031496062992,
      bottom: 0.15748031496062992,
      header: 0.31496062992125984,
      footer: 0.31496062992125984,
    },
  };

  workbook.addWorksheet("Sheet3");

  return worksheet;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function titleDrawingXml(dateLabel: string) {
  const safeDate = escapeXml(dateLabel);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <xdr:twoCellAnchor>
    <xdr:from>
      <xdr:col>3</xdr:col><xdr:colOff>381000</xdr:colOff>
      <xdr:row>0</xdr:row><xdr:rowOff>0</xdr:rowOff>
    </xdr:from>
    <xdr:to>
      <xdr:col>8</xdr:col><xdr:colOff>1333500</xdr:colOff>
      <xdr:row>1</xdr:row><xdr:rowOff>104775</xdr:rowOff>
    </xdr:to>
    <xdr:sp macro="" textlink="">
      <xdr:nvSpPr>
        <xdr:cNvPr id="3" name="ZoneTexte 2"/>
        <xdr:cNvSpPr txBox="1"/>
      </xdr:nvSpPr>
      <xdr:spPr>
        <a:xfrm>
          <a:off x="942975" y="0"/>
          <a:ext cx="4791075" cy="533400"/>
        </a:xfrm>
        <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        <a:solidFill><a:schemeClr val="lt1"/></a:solidFill>
        <a:ln w="9525" cmpd="sng">
          <a:solidFill><a:schemeClr val="lt1"><a:shade val="50000"/></a:schemeClr></a:solidFill>
        </a:ln>
      </xdr:spPr>
      <xdr:style>
        <a:lnRef idx="0"><a:scrgbClr r="0" g="0" b="0"/></a:lnRef>
        <a:fillRef idx="0"><a:scrgbClr r="0" g="0" b="0"/></a:fillRef>
        <a:effectRef idx="0"><a:scrgbClr r="0" g="0" b="0"/></a:effectRef>
        <a:fontRef idx="minor"><a:schemeClr val="dk1"/></a:fontRef>
      </xdr:style>
      <xdr:txBody>
        <a:bodyPr vertOverflow="clip" horzOverflow="clip" wrap="square" rtlCol="0" anchor="t"/>
        <a:lstStyle/>
        <a:p>
          <a:pPr algn="ctr" rtl="1"/>
          <a:r>
            <a:rPr lang="ar-MA" sz="1200" b="1"/>
            <a:t>لائحة المراقبين بمكاتب التصويت للانتخابات التشريعية</a:t>
          </a:r>
        </a:p>
        <a:p>
          <a:pPr algn="ctr" rtl="1"/>
          <a:r>
            <a:rPr lang="ar-MA" sz="1200" b="1"/>
            <a:t>اقتراع ${safeDate}</a:t>
          </a:r>
          <a:endParaRPr lang="ar-MA" sz="1200" b="1"/>
        </a:p>
      </xdr:txBody>
    </xdr:sp>
    <xdr:clientData/>
  </xdr:twoCellAnchor>
</xdr:wsDr>`;
}

async function injectReferenceTitleBox(
  workbookBuffer: ArrayBuffer,
  dateLabel: string,
) {
  const zip = await JSZip.loadAsync(workbookBuffer);

  const sheetPath = "xl/worksheets/sheet1.xml";
  const relPath = "xl/worksheets/_rels/sheet1.xml.rels";
  const contentTypesPath = "[Content_Types].xml";
  const drawingPath = "xl/drawings/drawing1.xml";

  const sheetFile = zip.file(sheetPath);
  const typesFile = zip.file(contentTypesPath);
  if (!sheetFile || !typesFile) {
    throw new Error("تعذر تجهيز بنية ملف Excel المرجعي.");
  }

  let sheetXml = await sheetFile.async("string");
  let relXml = zip.file(relPath)
    ? await zip.file(relPath)!.async("string")
    : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';

  const usedIds = [...relXml.matchAll(/Id="rId(\d+)"/g)].map((match) =>
    Number(match[1]),
  );
  const nextId = Math.max(0, ...usedIds) + 1;
  const relationId = `rId${nextId}`;

  if (!sheetXml.includes("xmlns:r=")) {
    sheetXml = sheetXml.replace(
      /<worksheet\b/,
      '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
    );
  }

  sheetXml = sheetXml.replace(/<drawing\b[^>]*\/>/g, "");
  sheetXml = sheetXml.replace(
    "</worksheet>",
    `<drawing r:id="${relationId}"/></worksheet>`,
  );

  relXml = relXml.replace(
    /<Relationship\b[^>]*Type="http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships\/drawing"[^>]*\/>/g,
    "",
  );
  relXml = relXml.replace(
    "</Relationships>",
    `<Relationship Id="${relationId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`,
  );

  let contentTypes = await typesFile.async("string");
  if (!contentTypes.includes('PartName="/xl/drawings/drawing1.xml"')) {
    contentTypes = contentTypes.replace(
      "</Types>",
      '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>',
    );
  }

  zip.file(sheetPath, sheetXml);
  zip.file(relPath, relXml);
  zip.file(contentTypesPath, contentTypes);
  zip.file(drawingPath, titleDrawingXml(dateLabel));

  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

function safeFilename(value: string) {
  const cleaned = value.replace(/[\\/:*?"<>|]/g, " ").trim();
  return cleaned || "معطيات المراقبين";
}

export async function downloadPollingAreaWorkbook({
  areaName,
  sourceFilename,
  electionDate,
  rows,
}: {
  areaName: string;
  sourceFilename?: string | null;
  electionDate: string;
  rows: PollingAreaExportRow[];
}) {
  const workbook = new ExcelJS.Workbook();
  buildAreaSheet(workbook, electionDate, rows);

  const buffer = await workbook.xlsx.writeBuffer();
  const exactBuffer = await injectReferenceTitleBox(
    buffer,
    electionDateLabel(electionDate),
  );
  const blob = new Blob([exactBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;

  const preferred = sourceFilename?.toLowerCase().endsWith(".xlsx")
    ? sourceFilename.slice(0, -5)
    : sourceFilename || areaName;
  anchor.download = `${safeFilename(preferred)}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}
